import {
  Controller,
  Get,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { BudgetsModule } from '../budgets/budgets.module';
import { BudgetsService } from '../budgets/budgets.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

export interface Insight {
  code: string;
  severity: 'good' | 'info' | 'warning' | 'action';
  params: Record<string, string | number>;
}

@Injectable()
class InsightsService {
  constructor(
    private prisma: PrismaService,
    private budgets: BudgetsService,
  ) {}

  /** Avis du jour : règles déterministes sur l'état courant des budgets visibles. */
  async today(
    user: User,
  ): Promise<{ date: string; negativeCount: number; items: Insight[] }> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const items: Insight[] = [];
    let negativeCount = 0;

    const budgets = await this.budgets.list(user, year, month);
    const active = [budgets.household, budgets.personal].filter(
      (p): p is NonNullable<typeof p> => !!p,
    );

    // Budget(s) en brouillon à valider
    for (const p of active) {
      if (p.status === 'DRAFT') {
        items.push({
          code: 'draft_pending',
          severity: 'action',
          params: { scope: p === budgets.household ? 'household' : 'personal', month },
        });
      }
    }

    for (const p of active) {
      if (p.status !== 'ACTIVE') continue;
      const scope = p === budgets.household ? 'household' : 'personal';
      const unassigned = BigInt(p.totals.unassigned);
      if (unassigned > 0n) {
        items.push({
          code: 'unassigned_funds',
          severity: 'info',
          params: { scope, amount: unassigned.toString() },
        });
      }
      const negative = p.lines.filter((l) => BigInt(l.available) < 0n);
      negativeCount += negative.length;
      if (negative.length) {
        items.push({
          code: 'envelopes_overdrawn',
          severity: 'warning',
          params: {
            scope,
            count: negative.length,
            names: negative
              .slice(0, 3)
              .map((l) => l.envelope.name)
              .join(', '),
          },
        });
      }
      const allocated = BigInt(p.totals.allocated);
      const spent = BigInt(p.totals.spent);
      if (allocated > 0n) {
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const pace = Number(spent) / Number(allocated);
        const progress = now.getUTCDate() / daysInMonth;
        items.push({
          code: pace <= progress ? 'pace_ok' : 'pace_over',
          severity: pace <= progress ? 'good' : 'warning',
          params: {
            scope,
            percent: Math.round(pace * 100),
            daysProgress: Math.round(progress * 100),
          },
        });
      }
    }

    // Inactivité : pas de saisie depuis 3 jours
    const last = await this.prisma.transaction.findFirst({
      where: { createdById: user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const idleDays = last
      ? Math.floor((now.getTime() - last.createdAt.getTime()) / 86_400_000)
      : 999;
    if (idleDays >= 3) {
      items.push({ code: 'inactive_days', severity: 'info', params: { days: idleDays } });
    }

    // Anciennes périodes encore actives → suggestion de clôture
    const stale = await this.prisma.budgetPeriod.count({
      where: {
        householdId: user.householdId,
        status: 'ACTIVE',
        OR: [{ year: { lt: year } }, { year, month: { lt: month - 1 } }],
      },
    });
    if (stale > 0) {
      items.push({ code: 'close_old_periods', severity: 'action', params: { count: stale } });
    }

    // Jour de paie : revenu saisi ce mois + fonds non attribués → remplir les enveloppes
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    const income = await this.prisma.transaction.aggregate({
      where: {
        account: { householdId: user.householdId, ...visibleTo(user) },
        type: 'INCOME',
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });
    const incomeSum = income._sum.amount ?? 0n;
    if (incomeSum > 0n) {
      for (const p of active) {
        if (p.status !== 'ACTIVE' && p.status !== 'DRAFT') continue;
        const unassigned = BigInt(p.totals.unassigned);
        if (unassigned > 0n) {
          items.push({
            code: 'payday_available',
            severity: 'action',
            params: {
              scope: p === budgets.household ? 'household' : 'personal',
              amount: unassigned.toString(),
              income: incomeSum.toString(),
            },
          });
        }
      }
    }

    // Récap hebdo : dépenses 7 derniers jours vs les 7 précédents
    const dayMs = 86_400_000;
    const weekStart = new Date(now.getTime() - 7 * dayMs);
    const prevWeekStart = new Date(now.getTime() - 14 * dayMs);
    const [thisWeek, lastWeek] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          account: { householdId: user.householdId, ...visibleTo(user) },
          type: 'EXPENSE',
          date: { gt: weekStart, lte: now },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          account: { householdId: user.householdId, ...visibleTo(user) },
          type: 'EXPENSE',
          date: { gt: prevWeekStart, lte: weekStart },
        },
        _sum: { amount: true },
      }),
    ]);
    const tw = thisWeek._sum.amount ?? 0n;
    const lw = lastWeek._sum.amount ?? 0n;
    if (tw > 0n || lw > 0n) {
      const pct = lw > 0n ? Math.round((Number(tw) / Number(lw) - 1) * 100) : 100;
      items.push({
        code: 'weekly_recap',
        severity: pct >= 20 ? 'warning' : pct <= -10 ? 'good' : 'info',
        params: { thisWeek: tw.toString(), lastWeek: lw.toString(), pct },
      });
    }

    // Défi de la semaine : rester sous 75 % des dépenses de la semaine
    // dernière sur l'enveloppe la plus dépensée
    const budgetedEnvelopes = new Map<string, string>();
    for (const p of active)
      if (p.status !== 'CLOSED')
        for (const l of p.lines)
          if (BigInt(l.allocated) > 0n)
            budgetedEnvelopes.set(l.envelope.id, l.envelope.name);
    if (budgetedEnvelopes.size) {
      const [prevByEnv, thisByEnv] = await Promise.all([
        this.prisma.transaction.groupBy({
          by: ['envelopeId'],
          where: {
            account: { householdId: user.householdId, ...visibleTo(user) },
            type: 'EXPENSE',
            envelopeId: { in: [...budgetedEnvelopes.keys()] },
            date: { gt: prevWeekStart, lte: weekStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.groupBy({
          by: ['envelopeId'],
          where: {
            account: { householdId: user.householdId, ...visibleTo(user) },
            type: 'EXPENSE',
            envelopeId: { in: [...budgetedEnvelopes.keys()] },
            date: { gt: weekStart, lte: now },
          },
          _sum: { amount: true },
        }),
      ]);
      const top = prevByEnv
        .filter((s) => (s._sum.amount ?? 0n) > 0n)
        .sort((a, b) => Number((b._sum.amount ?? 0n) - (a._sum.amount ?? 0n)))[0];
      if (top?.envelopeId) {
        const target = ((top._sum.amount ?? 0n) * 75n) / 100n;
        const spent = thisByEnv.find((s) => s.envelopeId === top.envelopeId)
          ?._sum.amount ?? 0n;
        items.push({
          code: 'weekly_challenge',
          severity: spent > target ? 'warning' : 'action',
          params: {
            name: budgetedEnvelopes.get(top.envelopeId)!,
            target: target.toString(),
            amount: spent.toString(),
          },
        });
      }
    }

    // Prévision de fin de mois par périmètre actif
    for (const p of active) {
      if (p.status !== 'ACTIVE') continue;
      const allocated = BigInt(p.totals.allocated);
      if (allocated <= 0n) continue;
      const spent = BigInt(p.totals.spent);
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const projected = (spent * BigInt(daysInMonth)) / BigInt(now.getUTCDate());
      items.push({
        code: projected > allocated ? 'forecast_over' : 'forecast_ok',
        severity: projected > allocated ? 'warning' : 'good',
        params: {
          scope: p === budgets.household ? 'household' : 'personal',
          amount: projected.toString(),
          allocated: allocated.toString(),
        },
      });
    }

    // Coût mensuel des abonnements visibles
    const subs = await this.prisma.recurringTemplate.findMany({
      where: {
        householdId: user.householdId,
        isSubscription: true,
        kind: 'EXPENSE',
        ...visibleTo(user),
      },
      select: { amount: true, frequency: true },
    });
    if (subs.length) {
      const FACTOR = { WEEKLY: 52 / 12, MONTHLY: 1, QUARTERLY: 1 / 3, YEARLY: 1 / 12 };
      const monthly = subs.reduce(
        (acc, s) => acc + (Number(s.amount) * FACTOR[s.frequency] || 0),
        0,
      );
      items.push({
        code: 'subscriptions_total',
        severity: 'info',
        params: { count: subs.length, amount: Math.round(monthly).toString() },
      });
    }

    if (!items.length) {
      items.push({ code: 'all_good', severity: 'good', params: {} });
    }
    const order = { warning: 0, action: 1, info: 2, good: 3 };
    items.sort((a, b) => order[a.severity] - order[b.severity]);
    return { date: now.toISOString().slice(0, 10), negativeCount, items };
  }
}

@Controller('insights')
@UseGuards(JwtAuthGuard)
class InsightsController {
  constructor(private insights: InsightsService) {}

  @Get('today')
  today(@CurrentUser() user: User) {
    return this.insights.today(user);
  }
}

@Module({
  imports: [BudgetsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
