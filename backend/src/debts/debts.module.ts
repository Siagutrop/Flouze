import {
  BadRequestException,
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
import { IsBoolean, IsDefined, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertAccess, visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

const toBigInt = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : value === null
      ? null
      : BigInt(String(value));

class DebtDto {
  @IsString()
  @MinLength(1)
  person: string;

  @IsIn(['OWED_TO_ME', 'I_OWE'])
  direction: 'OWED_TO_ME' | 'I_OWE';

  @IsDefined()
  @Transform(toBigInt)
  amount: bigint;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

class UpdateDebtDto {
  @IsOptional() @IsString() @MinLength(1) person?: string;
  @IsOptional() @Transform(toBigInt) amount?: bigint;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsBoolean() closed?: boolean;
}

/** Enregistrement d'un remboursement (partiel ou total). */
class PaymentDto {
  @IsDefined()
  @Transform(toBigInt)
  amount: bigint;
}

@Injectable()
class DebtsService {
  constructor(private prisma: PrismaService) {}

  list(user: User) {
    return this.prisma.debt.findMany({
      where: { householdId: user.householdId, ...visibleTo(user) },
      include: { owner: { select: { id: true, displayName: true } } },
      orderBy: [{ closedAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(user: User, dto: DebtDto) {
    return this.prisma.debt.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        person: dto.person,
        direction: dto.direction,
        amount: dto.amount,
        note: dto.note,
      },
    });
  }

  async update(user: User, id: string, dto: UpdateDebtDto) {
    const debt = await this.find(user, id);
    return this.prisma.debt.update({
      where: { id },
      data: {
        person: dto.person,
        amount: dto.amount,
        note: dto.note,
        closedAt:
          dto.closed === undefined
            ? undefined
            : dto.closed
              ? (debt.closedAt ?? new Date())
              : null,
      },
    });
  }

  /** Ajoute un remboursement ; clôt automatiquement si tout est payé. */
  async pay(user: User, id: string, dto: PaymentDto) {
    const debt = await this.find(user, id);
    if (dto.amount <= 0n) throw new BadRequestException('debts.invalidAmount');
    const paid = debt.paid + dto.amount;
    return this.prisma.debt.update({
      where: { id },
      data: {
        paid: paid > debt.amount ? debt.amount : paid,
        closedAt: paid >= debt.amount ? new Date() : null,
      },
    });
  }

  async remove(user: User, id: string) {
    await this.find(user, id);
    await this.prisma.debt.delete({ where: { id } });
    return { deleted: true };
  }

  private async find(user: User, id: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(debt, user);
    return debt!;
  }
}

@Controller('debts')
@UseGuards(JwtAuthGuard)
class DebtsController {
  constructor(private debts: DebtsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.debts.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: DebtDto) {
    return this.debts.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateDebtDto) {
    return this.debts.update(user, id, dto);
  }

  @Post(':id/pay')
  pay(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: PaymentDto) {
    return this.debts.pay(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.debts.remove(user, id);
  }
}

@Module({ controllers: [DebtsController], providers: [DebtsService] })
export class DebtsModule {}
