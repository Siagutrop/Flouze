import { Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsScheduler } from './budgets.scheduler';
import { BudgetsService } from './budgets.service';

@Module({
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetsScheduler],
  exports: [BudgetsService],
})
export class BudgetsModule {}
