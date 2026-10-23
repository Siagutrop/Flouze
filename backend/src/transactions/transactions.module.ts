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
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransactionType, User } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertAccess, visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.module';

const toBigInt = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ''
    ? undefined
    : BigInt(String(value));

class CreateTransactionDto {
  @IsIn(Object.values(TransactionType))
  type: TransactionType;

  @IsString()
  accountId: string;

  /** Requis si type = ACCOUNT_TRANSFER */
  @IsOptional()
  @IsString()
  toAccountId?: string;

  @IsOptional()
  @IsString()
  envelopeId?: string;

  /** Montant en unités mineures, toujours positif */
  @IsDefined()
  @Transform(toBigInt)
  amount: bigint;

  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  note?: string;

  /** Dépense obligatoire (loyer, factures…) */
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsDateString()
  date: string; // YYYY-MM-DD
}

class UpdateTransactionDto {
  @IsOptional()
  @IsIn(Object.values(TransactionType))
  type?: TransactionType;

  @IsOptional()
  @IsString()
  envelopeId?: string;

  @IsOptional()
  @Transform(toBigInt)
  amount?: bigint;

  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsDateString()
  date?: string;
}

class ListQueryDto {
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() envelopeId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() type?: TransactionType;
  /** 'true' → uniquement les dépenses obligatoires. */
  @IsOptional() @IsString() mandatory?: string;
  /** Recherche plein-texte sur libellé et note. */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Transform(({ value }) => parseInt(value as string, 10)) limit?: number;
}

@Injectable()
class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  /** Transactions visibles = celles des comptes accessibles à l'utilisateur. */
  async list(user: User, q: ListQueryDto) {
    const accountScope = {
      householdId: user.householdId,
      ...visibleTo(user),
    };
    return this.prisma.transaction.findMany({
      where: {
        account: accountScope,
        ...(q.accountId ? { accountId: q.accountId } : {}),
        ...(q.envelopeId ? { envelopeId: q.envelopeId } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.mandatory === 'true' ? { mandatory: true } : {}),
        ...(q.q
          ? {
              OR: [
                { label: { contains: q.q, mode: 'insensitive' as const } },
                { note: { contains: q.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(q.from || q.to
          ? {
              date: {
                ...(q.from ? { gte: new Date(q.from) } : {}),
                ...(q.to ? { lte: new Date(q.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        account: { select: { id: true, name: true, ownerId: true, currencyCode: true } },
        toAccount: { select: { id: true, name: true } },
        envelope: { select: { id: true, name: true, color: true } },
        createdBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(q.limit ?? 100, 500),
    });
  }

  async create(user: User, dto: CreateTransactionDto) {
    if (dto.amount <= 0n) {
      throw new BadRequestException('transaction.amountMustBePositive');
    }
    const account = await this.checkAccount(user, dto.accountId);
    let toAccountId: string | null = null;
    if (dto.type === TransactionType.ACCOUNT_TRANSFER) {
      if (!dto.toAccountId || dto.toAccountId === dto.accountId) {
        throw new BadRequestException('transaction.transferNeedsOtherAccount');
      }
      const to = await this.checkAccount(user, dto.toAccountId);
      toAccountId = to.id;
      // même devise requise pour un virement simple (pas de conversion en phase 1)
      if (to.currencyCode !== account.currencyCode) {
        throw new BadRequestException('transaction.crossCurrencyUnsupported');
      }
    }
    if (dto.envelopeId) await this.checkEnvelope(user, dto.envelopeId);

    const [tx] = await this.prisma.$transaction([
      this.prisma.transaction.create({
        data: {
          householdId: user.householdId,
          accountId: account.id,
          toAccountId,
          envelopeId: dto.envelopeId ?? null,
          type: dto.type,
          amount: dto.amount,
          label: dto.label,
          note: dto.note,
          mandatory: dto.mandatory ?? false,
          date: new Date(dto.date),
          createdById: user.id,
        },
      }),
      this.audit(user, 'transaction.created', { label: dto.label, type: dto.type }),
    ]);
    this.realtime.emit(user.householdId);
    await this.maybeAlertEnvelope(user, tx);
    return tx;
  }

  async update(user: User, id: string, dto: UpdateTransactionDto) {
    const tx = await this.getOwned(user, id);
    if (dto.envelopeId) await this.checkEnvelope(user, dto.envelopeId);
    if (dto.amount !== undefined && dto.amount <= 0n) {
      throw new BadRequestException('transaction.amountMustBePositive');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: tx.id },
        data: {
          type: dto.type,
          envelopeId: dto.envelopeId,
          amount: dto.amount,
          label: dto.label,
          note: dto.note,
          mandatory: dto.mandatory,
          date: dto.date ? new Date(dto.date) : undefined,
        },
      }),
      this.audit(user, 'transaction.updated', { id: tx.id }),
    ]);
    this.realtime.emit(user.householdId);
    await this.maybeAlertEnvelope(user, updated);
    return updated;
  }

  async remove(user: User, id: string) {
    const tx = await this.getOwned(user, id);
    await this.prisma.$transaction([
      this.prisma.transaction.delete({ where: { id: tx.id } }),
      this.audit(user, 'transaction.deleted', { id: tx.id }),
    ]);
    this.realtime.emit(user.householdId);
    return { deleted: true };
  }

  private async getOwned(user: User, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: {
        id,
        account: { householdId: user.householdId, ...visibleTo(user) },
      },
      include: { account: true },
    });
    assertAccess(tx?.account, user);
    return tx!;
  }

  private async checkAccount(user: User, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, householdId: user.householdId, archivedAt: null },
    });
    try {
      assertAccess(account, user);
    } catch {
      throw new BadRequestException('transaction.unknownAccount');
    }
    return account!;
  }

  private async checkEnvelope(user: User, envelopeId: string) {
    const envelope = await this.prisma.envelope.findFirst({
      where: { id: envelopeId, householdId: user.householdId, archivedAt: null },
    });
    try {
      assertAccess(envelope, user);
    } catch {
      throw new BadRequestException('transaction.unknownEnvelope');
    }
    return envelope!;
  }

  /**
   * Après une dépense liée à une enveloppe : émet une alerte SSE si le
   * disponible du mois passe sous le seuil de l'enveloppe (ou en négatif).
   */
  private async maybeAlertEnvelope(user: User, tx: { type: string; envelopeId: string | null; date: Date }) {
    if (tx.type !== 'EXPENSE' || !tx.envelopeId) return;
    const envelope = await this.prisma.envelope.findUnique({
      where: { id: tx.envelopeId },
    });
    if (!envelope) return;
    const y = tx.date.getUTCFullYear();
    const m = tx.date.getUTCMonth() + 1;
    const period = await this.prisma.budgetPeriod.findFirst({
      where: {
        householdId: user.householdId,
        ownerId: envelope.ownerId,
        year: y,
        month: m,
      },
      include: { lines: true },
    });
    const line = period?.lines.find((l) => l.envelopeId === envelope.id);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 0));
    const spent = await this.prisma.transaction.aggregate({
      where: {
        envelopeId: envelope.id,
        type: 'EXPENSE',
        date: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });
    const transfers = period
      ? await this.prisma.envelopeTransfer.findMany({
          where: {
            periodId: period.id,
            OR: [{ fromEnvelopeId: envelope.id }, { toEnvelopeId: envelope.id }],
          },
          select: { amount: true, fromEnvelopeId: true, toEnvelopeId: true },
        })
      : [];
    const netTransfers = transfers.reduce(
      (acc: bigint, t) =>
        acc + (t.toEnvelopeId === envelope.id ? t.amount : -t.amount),
      0n,
    );
    const available =
      (line?.allocated ?? 0n) + (line?.carryoverIn ?? 0n) + netTransfers - (spent._sum.amount ?? 0n);
    const threshold = envelope.alertThreshold ?? 0n;
    if (available < threshold || available < 0n) {
      this.realtime.emit(user.householdId, {
        type: 'envelope_alert',
        envelopeName: envelope.name,
        available: available.toString(),
        scope: envelope.ownerId ? 'personal' : 'household',
      });
    }
  }

  private audit(user: User, action: string, metadata: object) {
    return this.prisma.auditLog.create({
      data: {
        householdId: user.householdId,
        userId: user.id,
        action,
        entityType: 'transaction',
        metadata,
      },
    });
  }
}

@Controller('transactions')
@UseGuards(JwtAuthGuard)
class TransactionsController {
  constructor(private transactions: TransactionsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() q: ListQueryDto) {
    return this.transactions.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTransactionDto) {
    return this.transactions.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateTransactionDto) {
    return this.transactions.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.transactions.remove(user, id);
  }
}

@Module({ controllers: [TransactionsController], providers: [TransactionsService] })
export class TransactionsModule {}
