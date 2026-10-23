import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from './budgets.service';

/**
 * Tous les jours à 00h15 :
 *  1. si aujourd'hui = budgetGenerationDay du foyer → génère le draft du mois suivant
 *  2. auto-activation des drafts dont le mois a commencé (personne n'a validé ? pas de trou)
 *  3. auto-clôture des périodes actives vieilles de plus d'un mois
 */
@Injectable()
export class BudgetsScheduler {
  private readonly logger = new Logger(BudgetsScheduler.name);

  constructor(
    private prisma: PrismaService,
    private budgets: BudgetsService,
  ) {}

  @Cron('15 0 * * *')
  async daily() {
    const now = new Date();
    const nextMonth =
      now.getUTCMonth() === 11
        ? { y: now.getUTCFullYear() + 1, m: 1 }
        : { y: now.getUTCFullYear(), m: now.getUTCMonth() + 2 };

    const dueHouseholds = await this.prisma.household.findMany({
      where: { budgetGenerationDay: now.getUTCDate() },
    });
    for (const h of dueHouseholds) {
      this.logger.log(`Génération budget ${nextMonth.y}-${nextMonth.m} pour foyer ${h.id}`);
      await this.budgets.generate(h, nextMonth.y, nextMonth.m);
    }

    const activated = await this.prisma.budgetPeriod.updateMany({
      where: {
        status: PeriodStatus.DRAFT,
        OR: [
          { year: { lt: now.getUTCFullYear() } },
          { year: now.getUTCFullYear(), month: { lte: now.getUTCMonth() + 1 } },
        ],
      },
      data: { status: PeriodStatus.ACTIVE, validatedAt: now },
    });
    if (activated.count) this.logger.log(`${activated.count} budget(s) activé(s)`);

    // Clôture des périodes ACTIVE plus vieilles que le mois dernier
    const curIdx = now.getUTCFullYear() * 12 + now.getUTCMonth(); // mois courant, base 0
    const thrIdx = curIdx - 2; // seuil : tout ce qui précède le mois dernier
    const thrYear = Math.floor(thrIdx / 12);
    const thrMonth = (thrIdx % 12) + 1;
    const closed = await this.prisma.budgetPeriod.updateMany({
      where: {
        status: PeriodStatus.ACTIVE,
        OR: [
          { year: { lt: thrYear } },
          { year: thrYear, month: { lte: thrMonth } },
        ],
      },
      data: { status: PeriodStatus.CLOSED, closedAt: now },
    });
    if (closed.count) this.logger.log(`${closed.count} budget(s) clôturé(s)`);
  }
}
