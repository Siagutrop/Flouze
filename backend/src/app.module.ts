import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountsModule } from './accounts/accounts.module';
import { AuthModule } from './auth/auth.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { CreditsModule } from './credits/credits.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DebtsModule } from './debts/debts.module';
import { EnvelopesModule } from './envelopes/envelopes.module';
import { ExportsModule } from './exports/exports.module';
import { GamificationModule } from './gamification/gamification.module';
import { GoalsModule } from './goals/goals.module';
import { HouseholdsModule } from './households/households.module';
import { InsightsModule } from './insights/insights.module';
import { PrismaModule } from './prisma/prisma.module';
import { PushModule } from './push/push.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RecurringModule } from './recurring/recurring.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TxTemplatesModule } from './tx-templates/tx-templates.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    HouseholdsModule,
    CurrenciesModule,
    AccountsModule,
    CategoriesModule,
    EnvelopesModule,
    TransactionsModule,
    TxTemplatesModule,
    DebtsModule,
    RealtimeModule,
    BudgetsModule,
    RecurringModule,
    CreditsModule,
    GoalsModule,
    DashboardModule,
    ExportsModule,
    GamificationModule,
    InsightsModule,
    PushModule,
  ],
})
export class AppModule {}
