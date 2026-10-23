import { Controller, Get, Module, Sse, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { Observable, map } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { AccountsModule } from '../accounts/accounts.module';
import { BudgetsService } from '../budgets/budgets.service';
import { BudgetsModule } from '../budgets/budgets.module';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.module';
import { visibleTo } from '../common/ownership';

@Injectable()
class DashboardService {
  constructor(
    private prisma: PrismaService,
    private accounts: AccountsService,
    private budgets: BudgetsService,
  ) {}

  async summary(user: User) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const [accounts, budget, recent, goals, credits] = await Promise.all([
      this.accounts.list(user),
      this.budgets.list(user, year, month),
      this.prisma.transaction.findMany({
        where: { account: { householdId: user.householdId, ...visibleTo(user) } },
        include: {
          account: { select: { name: true, currencyCode: true } },
          envelope: { select: { name: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.savingsGoal.findMany({
        where: { householdId: user.householdId, ...visibleTo(user) },
      }),
      this.prisma.credit.findMany({
        where: { householdId: user.householdId, ...visibleTo(user) },
      }),
    ]);

    // Dépenses mensuelles des 6 derniers mois (pour le graphique)
    const sixMonthsAgo = new Date(Date.UTC(year, month - 7, 1));
    const expenses = await this.prisma.transaction.findMany({
      where: {
        account: { householdId: user.householdId, ...visibleTo(user) },
        type: 'EXPENSE',
        date: { gte: sixMonthsAgo },
      },
      select: { amount: true, date: true },
    });
    const monthly = new Map<string, bigint>();
    for (const e of expenses) {
      const key = e.date.toISOString().slice(0, 7);
      monthly.set(key, (monthly.get(key) ?? 0n) + e.amount);
    }
    const monthlySpend = [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    // Répartition des dépenses du mois courant : par enveloppe et par
    // caractère obligatoire (loyer, crédit, factures…) ou non.
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));
    const monthExpenses = await this.prisma.transaction.findMany({
      where: {
        account: { householdId: user.householdId, ...visibleTo(user) },
        type: 'EXPENSE',
        date: { gte: monthStart, lt: monthEnd },
      },
      select: {
        amount: true,
        mandatory: true,
        envelope: { select: { id: true, name: true, icon: true } },
      },
    });
    // Dépenses du mois précédent par enveloppe (badges comparatifs N vs N-1)
    const prevMonthExpenses = await this.prisma.transaction.groupBy({
      by: ['envelopeId'],
      where: {
        account: { householdId: user.householdId, ...visibleTo(user) },
        type: 'EXPENSE',
        date: {
          gte: new Date(Date.UTC(year, month - 2, 1)),
          lt: monthStart,
        },
      },
      _sum: { amount: true },
    });
    const prevByEnv = new Map(
      prevMonthExpenses.map((g) => [g.envelopeId ?? '', g._sum.amount ?? 0n]),
    );

    const byEnvelope = new Map<
      string,
      { id: string | null; name: string | null; icon: string | null; amount: bigint; mandatory: bigint; prev: bigint }
    >();
    let mandatoryTotal = 0n;
    let optionalTotal = 0n;
    for (const tx of monthExpenses) {
      const key = tx.envelope?.id ?? '';
      const cur =
        byEnvelope.get(key) ?? {
          id: tx.envelope?.id ?? null,
          name: tx.envelope?.name ?? null,
          icon: tx.envelope?.icon ?? null,
          amount: 0n,
          mandatory: 0n,
          prev: prevByEnv.get(key) ?? 0n,
        };
      cur.amount += tx.amount;
      if (tx.mandatory) {
        cur.mandatory += tx.amount;
        mandatoryTotal += tx.amount;
      } else {
        optionalTotal += tx.amount;
      }
      byEnvelope.set(key, cur);
    }
    const breakdown = {
      byEnvelope: [...byEnvelope.values()].sort((a, b) =>
        a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0,
      ),
      mandatory: mandatoryTotal,
      optional: optionalTotal,
      total: mandatoryTotal + optionalTotal,
    };

    const totalBalance = accounts.reduce((a, x) => a + BigInt(x.balance), 0n);

    // ── Rythme du mois : solde projeté au 31 + reste à vivre par jour ──
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const dayOfMonth = now.getUTCDate();
    const remainingDays = daysInMonth - dayOfMonth + 1; // aujourd'hui inclus
    const dailyRate =
      dayOfMonth > 0 ? breakdown.total / BigInt(dayOfMonth) : 0n;
    const availableTotal =
      (budget.household?.totals.available ?? 0n) +
      (budget.personal?.totals.available ?? 0n);
    const pace = {
      projected: totalBalance - dailyRate * BigInt(remainingDays - 1),
      dailyLeft:
        remainingDays > 0 ? availableTotal / BigInt(remainingDays) : 0n,
      daysLeft: remainingDays,
      available: availableTotal,
    };

    // ── Alertes enveloppes : négatif ou sous le seuil d'alerte ──
    const alerts: {
      envelopeId: string;
      name: string;
      icon: string | null;
      available: bigint;
      threshold: bigint | null;
      severity: 'over' | 'low';
      scope: 'household' | 'personal';
    }[] = [];
    const scopes: ['household' | 'personal', typeof budget.household][] = [
      ['household', budget.household],
      ['personal', budget.personal],
    ];
    for (const [scope, period] of scopes) {
      for (const l of period?.lines ?? []) {
        const env = l.envelope as { id: string; name: string; icon: string | null; alertThreshold: bigint | null };
        if (l.available < 0n) {
          alerts.push({
            envelopeId: env.id,
            name: env.name,
            icon: env.icon,
            available: l.available,
            threshold: env.alertThreshold ?? null,
            severity: 'over',
            scope,
          });
        } else if (env.alertThreshold != null && l.available < env.alertThreshold) {
          alerts.push({
            envelopeId: env.id,
            name: env.name,
            icon: env.icon,
            available: l.available,
            threshold: env.alertThreshold,
            severity: 'low',
            scope,
          });
        }
      }
    }

    return {
      totals: {
        accountsBalance: totalBalance,
        accountsCount: accounts.length,
        activeGoals: goals.length,
        creditsRemaining: credits.length,
      },
      accounts,
      budget,
      monthlySpend,
      breakdown,
      pace,
      alerts,
      recent,
    };
  }
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
class DashboardController {
  constructor(
    private dashboard: DashboardService,
    private realtime: RealtimeService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.dashboard.summary(user);
  }

  /** Flux SSE : un événement {at} est émis à chaque mutation du foyer. */
  @Sse('events')
  events(@CurrentUser() user: User): Observable<MessageEvent> {
    return this.realtime
      .forHousehold(user.householdId)
      .pipe(map((e) => ({ data: e }) as MessageEvent));
  }
}

@Module({
  imports: [AccountsModule, BudgetsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
