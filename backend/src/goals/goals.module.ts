import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertAccess, visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

const toBigInt = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : BigInt(String(value));

class GoalDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsDefined()
  @Transform(toBigInt)
  targetAmount: bigint;

  @IsOptional()
  @IsString()
  icon?: string;

  /** Fond visuel : clé de dégradé (cover:…) ou data-URL */
  @IsOptional()
  @IsString()
  cover?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  envelopeId?: string;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

class UpdateGoalDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() cover?: string;
  @IsOptional() @Transform(toBigInt) targetAmount?: bigint;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() accountId?: string;
}

@Injectable()
class GoalsService {
  constructor(private prisma: PrismaService) {}

  async list(user: User) {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { householdId: user.householdId, ...visibleTo(user) },
      include: {
        account: { select: { id: true, name: true } },
        envelope: { select: { id: true, name: true } },
        owner: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    // Progression = solde du compte lié (sinon 0 — affiné quand budget actif)
    return Promise.all(
      goals.map(async (g) => ({
        ...g,
        currentAmount: g.accountId ? await this.accountBalance(g.accountId) : 0n,
      })),
    );
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
    const sums = { inc: 0n, exp: 0n, tr: 0n };
    for (const g of out) {
      const s = g._sum.amount ?? 0n;
      if (g.type === 'INCOME') sums.inc = s;
      else if (g.type === 'EXPENSE') sums.exp = s;
      else sums.tr = s;
    }
    return a.initialBalance + sums.inc - sums.exp - sums.tr + (into._sum.amount ?? 0n);
  }

  create(user: User, dto: GoalDto) {
    return this.prisma.savingsGoal.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        name: dto.name,
        icon: dto.icon ?? null,
        cover: dto.cover ?? null,
        targetAmount: dto.targetAmount,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        accountId: dto.accountId ?? null,
        envelopeId: dto.envelopeId ?? null,
      },
    });
  }

  async update(user: User, id: string, dto: UpdateGoalDto) {
    const g = await this.prisma.savingsGoal.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(g, user);
    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        ...dto,
        deadline:
          dto.deadline === undefined || dto.deadline === null
            ? dto.deadline === null
              ? null
              : undefined
            : new Date(dto.deadline),
      },
    });
  }

  async remove(user: User, id: string) {
    const g = await this.prisma.savingsGoal.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(g, user);
    await this.prisma.savingsGoal.delete({ where: { id } });
    return { deleted: true };
  }
}

@Controller('goals')
@UseGuards(JwtAuthGuard)
class GoalsController {
  constructor(private goals: GoalsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.goals.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: GoalDto) {
    return this.goals.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.goals.remove(user, id);
  }
}

@Module({ controllers: [GoalsController], providers: [GoalsService] })
export class GoalsModule {}
