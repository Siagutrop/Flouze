import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BudgetPeriod,
  Household,
  PeriodStatus,
  Prisma,
  RecurringKind,
  User,
} from '@prisma/client';
import { assertAccess } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.module';
import { occurrencesInMonth } from '../recurring/occurrences';

interface LineStats {
  spent: bigint;
  netTransfers: bigint;
}

@Injectable()
export class BudgetsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  /** Périodes visibles : budget du foyer + budget personnel de l'utilisateur. */
  async list(user: User, year: number, month: number) {
    const periods = await this.prisma.budgetPeriod.findMany({
      where: {
        householdId: user.householdId,
        year,
        month,
        OR: [{ ownerId: null }, { ownerId: user.id }],
      },
      include: { lines: { include: { envelope: true } } },
    });
    return {
      household: await this.view(periods.find((p) => p.ownerId === null), null),
      personal: await this.view(periods.find((p) => p.ownerId === user.id), user.id),
    };
  }

  /** Vue calculée d'une période : dépensé, net transferts, disponible, non attribué. */
  private async view(period: BudgetPeriod & { lines: any[] } | undefined, scope: string | null) {
    if (!period) return null;
    const stats = await this.computeStats(period);
    // Toutes les enveloppes actives du scope apparaissent, même sans ligne
    const envelopes = await this.prisma.envelope.findMany({
      where: { householdId: period.householdId, ownerId: scope, archivedAt: null },
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    // Dépensé du mois précédent par enveloppe (comparaison N vs N-1)
    const prevSpentAgg = await this.prisma.transaction.groupBy({
      by: ['envelopeId'],
      where: {
        householdId: period.householdId,
        envelopeId: { in: envelopes.map((e) => e.id) },
        type: 'EXPENSE',
        date: {
          gte: new Date(Date.UTC(period.year, period.month - 2, 1)),
          lte: new Date(Date.UTC(period.year, period.month - 1, 0)),
        },
      },
      _sum: { amount: true },
    });
    const prevSpent = new Map(
      prevSpentAgg.map((s) => [s.envelopeId!, s._sum.amount ?? 0n]),
    );

    const lineByEnvelope = new Map(period.lines.map((l) => [l.envelopeId, l]));
    const lines = envelopes.map((envelope) => {
      const l = lineByEnvelope.get(envelope.id) ?? {
        id: null,
        allocated: 0n,
        carryoverIn: 0n,
      };
      const s = stats.get(envelope.id) ?? { spent: 0n, netTransfers: 0n };
      return {
        id: l.id,
        envelope,
        allocated: l.allocated,
        carryoverIn: l.carryoverIn,
        spent: s.spent,
        prevSpent: prevSpent.get(envelope.id) ?? 0n,
        netTransfers: s.netTransfers,
        available: l.allocated + l.carryoverIn + s.netTransfers - s.spent,
      };
    });
    const scopeFunds = await this.scopeFunds(period.householdId, scope);
    const assigned = lines.reduce(
      (acc, l) => acc + l.allocated + l.carryoverIn + l.netTransfers,
      0n,
    );
    return {
      id: period.id,
      year: period.year,
      month: period.month,
      status: period.status,
      generatedAt: period.generatedAt,
      validatedAt: period.validatedAt,
      closedAt: period.closedAt,
      lines,
      totals: {
        allocated: lines.reduce((a, l) => a + l.allocated, 0n),
        spent: lines.reduce((a, l) => a + l.spent, 0n),
        available: lines.reduce((a, l) => a + l.available, 0n),
        scopeFunds,
        unassigned: scopeFunds - assigned,
      },
    };
  }

  /** dépensé par enveloppe + solde net des transferts, sur le mois de la période. */
  private async computeStats(period: BudgetPeriod): Promise<Map<string, LineStats>> {
    const from = new Date(Date.UTC(period.year, period.month - 1, 1));
    const to = new Date(Date.UTC(period.year, period.month, 0));
    const [spent, transfers] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['envelopeId'],
        where: {
          householdId: period.householdId,
          envelopeId: { not: null },
          type: 'EXPENSE',
          date: { gte: from, lte: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.envelopeTransfer.groupBy({
        by: ['fromEnvelopeId', 'toEnvelopeId'],
        where: { periodId: period.id },
        _sum: { amount: true },
      }),
    ]);
    const stats = new Map<string, LineStats>();
    const get = (id: string) => {
      if (!stats.has(id)) stats.set(id, { spent: 0n, netTransfers: 0n });
      return stats.get(id)!;
    };
    for (const s of spent) {
      if (s.envelopeId) get(s.envelopeId).spent += s._sum.amount ?? 0n;
    }
    for (const tr of transfers) {
      const amount = tr._sum.amount ?? 0n;
      get(tr.fromEnvelopeId).netTransfers -= amount;
      get(tr.toEnvelopeId).netTransfers += amount;
    }
    return stats;
  }

  /** Fonds disponibles du périmètre = somme des soldes des comptes du scope. */
  private async scopeFunds(householdId: string, scope: string | null) {
    const accounts = await this.prisma.account.findMany({
      where: { householdId, ownerId: scope, archivedAt: null },
    });
    const ids = accounts.map((a) => a.id);
    const [out, into] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { accountId: { in: ids } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['toAccountId'],
        where: { toAccountId: { in: ids }, type: 'ACCOUNT_TRANSFER' },
        _sum: { amount: true },
      }),
    ]);
    const inMap = new Map(into.map((g) => [g.toAccountId, g._sum.amount ?? 0n]));
    const outMap = new Map<string, { inc: bigint; exp: bigint; tr: bigint }>();
    for (const g of out) {
      const s = outMap.get(g.accountId) ?? { inc: 0n, exp: 0n, tr: 0n };
      const sum = g._sum.amount ?? 0n;
      if (g.type === 'INCOME') s.inc += sum;
      else if (g.type === 'EXPENSE') s.exp += sum;
      else s.tr += sum;
      outMap.set(g.accountId, s);
    }
    return accounts.reduce((total, a) => {
      const s = outMap.get(a.id) ?? { inc: 0n, exp: 0n, tr: 0n };
      return total + a.initialBalance + s.inc - s.exp - s.tr + (inMap.get(a.id) ?? 0n);
    }, 0n);
  }

  /**
   * Génère les budgets draft du mois (year, month) pour un foyer :
   * scope foyer + scope de chaque membre. Idempotent.
   */
  async generate(household: Household, year: number, month: number) {
    const members = await this.prisma.user.findMany({
      where: { householdId: household.id },
      select: { id: true, role: true },
    });
    const fallbackCreator =
      members.find((m) => m.role === 'OWNER')?.id ?? members[0]?.id;
    const scopes: (string | null)[] = [null, ...members.map((m) => m.id)];
    for (const scope of scopes) {
      await this.generatePeriod(household.id, scope, year, month, fallbackCreator!);
    }
  }

  private async generatePeriod(
    householdId: string,
    ownerId: string | null,
    year: number,
    month: number,
    fallbackCreatorId: string,
  ) {
    const existing = await this.prisma.budgetPeriod.findFirst({
      where: { householdId, ownerId, year, month },
    });
    if (existing) return existing;

    const envelopes = await this.prisma.envelope.findMany({
      where: { householdId, ownerId, archivedAt: null },
    });
    const templates = await this.prisma.recurringTemplate.findMany({
      where: { householdId, ownerId },
    });

    // Reports du mois précédent (disponible par enveloppe)
    const prevIdx = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
    const prev = await this.prisma.budgetPeriod.findFirst({
      where: { householdId, ownerId, year: prevIdx.y, month: prevIdx.m },
      include: { lines: true },
    });
    const prevAvailable = new Map<string, bigint>();
    if (prev) {
      const prevStats = await this.computeStats(prev);
      for (const l of prev.lines) {
        const s = prevStats.get(l.envelopeId) ?? { spent: 0n, netTransfers: 0n };
        prevAvailable.set(
          l.envelopeId,
          l.allocated + l.carryoverIn + s.netTransfers - s.spent,
        );
      }
    }

    // Pré-remplissage : alloué = charges récurrentes prévues sur l'enveloppe
    const allocatedByEnvelope = new Map<string, bigint>();
    const materialized: Prisma.TransactionCreateManyInput[] = [];
    for (const t of templates) {
      const dates = occurrencesInMonth(t, year, month);
      if (dates.length === 0) continue;
      if (t.kind === RecurringKind.EXPENSE && t.envelopeId) {
        allocatedByEnvelope.set(
          t.envelopeId,
          (allocatedByEnvelope.get(t.envelopeId) ?? 0n) + t.amount * BigInt(dates.length),
        );
      }
      for (const d of dates) {
        materialized.push({
          householdId,
          accountId: t.accountId,
          envelopeId: t.envelopeId,
          type: t.kind === RecurringKind.INCOME ? 'INCOME' : 'EXPENSE',
          amount: t.amount,
          label: t.label,
          date: d,
          createdById: t.ownerId ?? ownerId ?? fallbackCreatorId,
        });
      }
    }

    const period = await this.prisma.budgetPeriod.create({
      data: {
        householdId,
        ownerId,
        year,
        month,
        status: PeriodStatus.DRAFT,
        lines: {
          create: envelopes.map((e) => ({
            envelopeId: e.id,
            allocated: allocatedByEnvelope.get(e.id) ?? 0n,
            carryoverIn: prevAvailable.get(e.id) ?? 0n,
          })),
        },
      },
      include: { lines: true },
    });

    if (materialized.length) {
      await this.prisma.transaction.createMany({ data: materialized });
    }
    await this.prisma.auditLog.create({
      data: {
        householdId,
        action: 'budget.generated',
        entityType: 'budgetPeriod',
        entityId: period.id,
        metadata: { year, month, scope: ownerId ?? 'household' },
      },
    });
    this.realtime.emit(householdId);
    return period;
  }

  /** Déclenchement manuel (« créer le mois ») — idempotent. */
  async generateNow(user: User, year: number, month: number) {
    const household = await this.prisma.household.findUnique({
      where: { id: user.householdId },
    });
    await this.generate(household!, year, month);
    return this.list(user, year, month);
  }

  async setAllocation(user: User, periodId: string, envelopeId: string, allocated: bigint) {
    const period = await this.getWritablePeriod(user, periodId);
    const envelope = await this.prisma.envelope.findFirst({
      where: { id: envelopeId, householdId: user.householdId, ownerId: period.ownerId },
    });
    if (!envelope) throw new BadRequestException('budget.unknownEnvelope');
    const line = await this.prisma.budgetLine.upsert({
      where: { periodId_envelopeId: { periodId, envelopeId } },
      update: { allocated },
      create: { periodId, envelopeId, allocated },
    });
    this.realtime.emit(user.householdId);
    return line;
  }

  async transfer(
    user: User,
    periodId: string,
    dto: { fromEnvelopeId: string; toEnvelopeId: string; amount: bigint; note?: string },
  ) {
    const period = await this.getWritablePeriod(user, periodId);
    if (dto.fromEnvelopeId === dto.toEnvelopeId || dto.amount <= 0n) {
      throw new BadRequestException('budget.invalidTransfer');
    }
    for (const id of [dto.fromEnvelopeId, dto.toEnvelopeId]) {
      const env = await this.prisma.envelope.findFirst({
        where: { id, householdId: user.householdId, ownerId: period.ownerId },
      });
      if (!env) throw new BadRequestException('budget.transferScopeMismatch');
    }
    const transfer = await this.prisma.envelopeTransfer.create({
      data: {
        householdId: user.householdId,
        periodId,
        fromEnvelopeId: dto.fromEnvelopeId,
        toEnvelopeId: dto.toEnvelopeId,
        amount: dto.amount,
        note: dto.note,
        date: new Date(),
        createdById: user.id,
      },
    });
    this.realtime.emit(user.householdId);
    return transfer;
  }

  /**
   * Recopie les allocations du mois précédent dans la période donnée
   * (mêmes enveloppes, même scope). Utile pour remplir vite un mois vide.
   */
  async copyPrevious(user: User, periodId: string) {
    const period = await this.getWritablePeriod(user, periodId);
    const prevIdx =
      period.month === 1
        ? { y: period.year - 1, m: 12 }
        : { y: period.year, m: period.month - 1 };
    const prev = await this.prisma.budgetPeriod.findFirst({
      where: {
        householdId: period.householdId,
        ownerId: period.ownerId,
        year: prevIdx.y,
        month: prevIdx.m,
      },
      include: { lines: true },
    });
    if (!prev || prev.lines.length === 0) {
      throw new BadRequestException('budget.noPrevious');
    }
    for (const l of prev.lines) {
      await this.prisma.budgetLine.upsert({
        where: { periodId_envelopeId: { periodId, envelopeId: l.envelopeId } },
        update: { allocated: l.allocated },
        create: { periodId, envelopeId: l.envelopeId, allocated: l.allocated },
      });
    }
    this.realtime.emit(user.householdId);
    return this.list(user, period.year, period.month);
  }

  async validate(user: User, periodId: string) {
    const period = await this.getPeriod(user, periodId);
    if (period.status !== PeriodStatus.DRAFT) {
      throw new BadRequestException('budget.notDraft');
    }
    const updated = await this.prisma.budgetPeriod.update({
      where: { id: periodId },
      data: { status: PeriodStatus.ACTIVE, validatedAt: new Date() },
    });
    this.realtime.emit(user.householdId);
    return updated;
  }

  async close(user: User, periodId: string) {
    const period = await this.getPeriod(user, periodId);
    if (period.status === PeriodStatus.CLOSED) {
      throw new BadRequestException('budget.alreadyClosed');
    }
    const updated = await this.prisma.budgetPeriod.update({
      where: { id: periodId },
      data: { status: PeriodStatus.CLOSED, closedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        householdId: user.householdId,
        userId: user.id,
        action: 'budget.closed',
        entityType: 'budgetPeriod',
        entityId: periodId,
      },
    });
    this.realtime.emit(user.householdId);
    return updated;
  }

  private async getPeriod(user: User, periodId: string) {
    const period = await this.prisma.budgetPeriod.findFirst({
      where: { id: periodId, householdId: user.householdId },
    });
    assertAccess(period, user);
    return period!;
  }

  private async getWritablePeriod(user: User, periodId: string) {
    const period = await this.getPeriod(user, periodId);
    if (period.status === PeriodStatus.CLOSED) {
      throw new ForbiddenException('budget.closed');
    }
    return period;
  }
}
