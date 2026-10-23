import {
  Controller,
  Get,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import { PeriodStatus, User } from '@prisma/client';
import { BudgetsModule } from '../budgets/budgets.module';
import { BudgetsService } from '../budgets/budgets.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

interface AchievementDef {
  code: string;
  points: number;
  check: (s: GamificationService, user: User) => Promise<boolean>;
}

export const TIERS = [
  { key: 'bronze', min: 0 },
  { key: 'argent', min: 50 },
  { key: 'or', min: 120 },
  { key: 'platine', min: 220 },
  { key: 'diamant', min: 400 },
];

@Injectable()
export class GamificationService {
  constructor(
    public prisma: PrismaService,
    private budgets: BudgetsService,
  ) {}

  private defs: AchievementDef[] = [
    {
      code: 'first_transaction',
      points: 10,
      check: async (s, u) =>
        (await s.prisma.transaction.count({ where: { createdById: u.id } })) > 0,
    },
    {
      code: 'budget_validated',
      points: 20,
      check: async (s, u) =>
        (await s.prisma.budgetPeriod.count({
          where: {
            householdId: u.householdId,
            status: { in: [PeriodStatus.ACTIVE, PeriodStatus.CLOSED] },
          },
        })) > 0,
    },
    {
      code: 'under_budget_month',
      points: 40,
      check: async (s, u) => {
        // un mois clôturé dont le total dépensé ≤ alloué (scope foyer ou perso)
        const closed = await s.prisma.budgetPeriod.findMany({
          where: { householdId: u.householdId, status: PeriodStatus.CLOSED },
          include: { lines: true },
        });
        for (const p of closed) {
          const from = new Date(Date.UTC(p.year, p.month - 1, 1));
          const to = new Date(Date.UTC(p.year, p.month, 0));
          const spent = await s.prisma.transaction.aggregate({
            where: {
              householdId: u.householdId,
              type: 'EXPENSE',
              date: { gte: from, lte: to },
              envelope: { ownerId: p.ownerId },
            },
            _sum: { amount: true },
          });
          const allocated = p.lines.reduce((a, l) => a + l.allocated, 0n);
          if (allocated > 0n && (spent._sum.amount ?? 0n) <= allocated) return true;
        }
        return false;
      },
    },
    {
      code: 'duo',
      points: 15,
      check: async (s, u) =>
        (await s.prisma.user.count({ where: { householdId: u.householdId } })) >= 2,
    },
    {
      code: 'planner',
      points: 15,
      check: async (s, u) =>
        (await s.prisma.recurringTemplate.count({
          where: { householdId: u.householdId, ownerId: u.id },
        })) >= 3,
    },
    {
      code: 'mover',
      points: 10,
      check: async (s, u) =>
        (await s.prisma.envelopeTransfer.count({
          where: { createdById: u.id },
        })) > 0,
    },
    {
      code: 'importer',
      points: 15,
      check: async (s, u) =>
        (await s.prisma.auditLog.count({
          where: { userId: u.id, action: 'import.transactions' },
        })) > 0,
    },
    {
      code: 'goal_set',
      points: 10,
      check: async (s, u) =>
        (await s.prisma.savingsGoal.count({ where: { ownerId: u.id } })) > 0,
    },
    {
      code: 'week_streak',
      points: 25,
      check: async (s, u) => (await s.streak(u.id)) >= 7,
    },
    {
      code: 'month_streak',
      points: 60,
      check: async (s, u) => (await s.streak(u.id)) >= 30,
    },
    {
      code: 'no_overspend',
      points: 30,
      check: async (s, u) => {
        const now = new Date();
        const b = await s.budgets.list(u, now.getUTCFullYear(), now.getUTCMonth() + 1);
        for (const p of [b.household, b.personal]) {
          if (!p || p.status === 'DRAFT') continue;
          if (p.lines.some((l) => BigInt(l.available) < 0n)) return false;
        }
        return (b.household ?? b.personal) != null;
      },
    },
    {
      code: 'challenge_won',
      points: 25,
      check: async (s, u) => {
        // dépenses des 7 derniers jours ≥ 30 % de moins que la semaine précédente
        const now = Date.now();
        const [tw, lw] = await Promise.all([
          s.prisma.transaction.aggregate({
            where: {
              createdById: u.id,
              type: 'EXPENSE',
              date: { gt: new Date(now - 7 * 86_400_000) },
            },
            _sum: { amount: true },
          }),
          s.prisma.transaction.aggregate({
            where: {
              createdById: u.id,
              type: 'EXPENSE',
              date: {
                gt: new Date(now - 14 * 86_400_000),
                lte: new Date(now - 7 * 86_400_000),
              },
            },
            _sum: { amount: true },
          }),
        ]);
        const prev = lw._sum.amount ?? 0n;
        return prev > 0n && (tw._sum.amount ?? 0n) * 10n <= prev * 7n;
      },
    },
    {
      code: 'nest_egg',
      points: 30,
      check: async (s, u) => {
        const goals = await s.prisma.savingsGoal.findMany({
          where: { householdId: u.householdId, accountId: { not: null } },
        });
        for (const g of goals) {
          if ((await s.accountBalance(g.accountId!)) >= g.targetAmount) return true;
        }
        return false;
      },
    },
  ];

  /** Jours consécutifs avec transaction saisie (en finissant aujourd'hui ou hier). */
  private async streak(userId: string): Promise<number> {
    const rows = await this.prisma.transaction.findMany({
      where: { createdById: userId },
      select: { date: true },
      orderBy: { date: 'desc' },
      take: 400,
    });
    const days = new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
    if (!days.size) return 0;
    let streak = 0;
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    // la série peut commencer aujourd'hui ou hier
    if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) {
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return streak;
  }

  private async accountBalance(accountId: string) {
    const a = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!a) return 0n;
    const [out, into] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { accountId },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { toAccountId: accountId, type: 'ACCOUNT_TRANSFER' },
        _sum: { amount: true },
      }),
    ]);
    let bal = a.initialBalance + (into._sum.amount ?? 0n);
    for (const g of out) {
      const s = g._sum.amount ?? 0n;
      if (g.type === 'INCOME') bal += s;
      else bal -= s;
    }
    return bal;
  }

  /** Évalue et attribue les badges manquants (idempotent), puis retourne le profil. */
  async evaluate(user: User) {
    const earned = await this.prisma.userAchievement.findMany({
      where: { userId: user.id },
    });
    const have = new Set(earned.map((a) => a.code));
    const fresh: string[] = [];
    for (const def of this.defs) {
      if (have.has(def.code)) continue;
      if (await def.check(this, user)) {
        await this.prisma.userAchievement.create({
          data: { userId: user.id, code: def.code },
        });
        fresh.push(def.code);
        have.add(def.code);
      }
    }
    const all = await this.prisma.userAchievement.findMany({
      where: { userId: user.id },
      orderBy: { earnedAt: 'desc' },
    });
    const points = all.reduce(
      (acc, a) => acc + (this.defs.find((d) => d.code === a.code)?.points ?? 0),
      0,
    );
    const tier = [...TIERS].reverse().find((t) => points >= t.min)!;
    const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
    return {
      points,
      tier: tier.key,
      nextTier: next,
      progressToNext: next
        ? Math.min(1, (points - tier.min) / (next.min - tier.min))
        : 1,
      achievements: all.map((a) => ({
        code: a.code,
        earnedAt: a.earnedAt,
        points: this.defs.find((d) => d.code === a.code)?.points ?? 0,
      })),
      newBadges: fresh,
      catalog: this.defs.map((d) => ({ code: d.code, points: d.points })),
    };
  }
}

@Controller('gamification')
@UseGuards(JwtAuthGuard)
class GamificationController {
  constructor(private g: GamificationService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.g.evaluate(user);
  }
}

@Module({
  imports: [BudgetsModule],
  controllers: [GamificationController],
  providers: [GamificationService],
})
export class GamificationModule {}
