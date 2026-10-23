import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Account, TransactionType, User } from '@prisma/client';
import { assertAccess, visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  /** Liste les comptes visibles (perso + foyer) avec leur solde courant. */
  async list(user: User) {
    const accounts = await this.prisma.account.findMany({
      where: {
        householdId: user.householdId,
        archivedAt: null,
        ...visibleTo(user),
      },
      include: {
        currency: true,
        owner: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Soldes = solde initial + revenus − dépenses ± virements
    const ids = accounts.map((a) => a.id);
    const [out, into] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['accountId', 'type'],
        where: { accountId: { in: ids } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['toAccountId'],
        where: { toAccountId: { in: ids }, type: TransactionType.ACCOUNT_TRANSFER },
        _sum: { amount: true },
      }),
    ]);
    const inMap = new Map(into.map((g) => [g.toAccountId, g._sum.amount ?? 0n]));
    const outMap = new Map<string, { income: bigint; expense: bigint; transfer: bigint }>();
    for (const g of out) {
      const acc = outMap.get(g.accountId) ?? { income: 0n, expense: 0n, transfer: 0n };
      const sum = g._sum.amount ?? 0n;
      if (g.type === TransactionType.INCOME) acc.income += sum;
      else if (g.type === TransactionType.EXPENSE) acc.expense += sum;
      else acc.transfer += sum;
      outMap.set(g.accountId, acc);
    }

    return accounts.map((a) => {
      const s = outMap.get(a.id) ?? { income: 0n, expense: 0n, transfer: 0n };
      const balance =
        a.initialBalance + s.income - s.expense - s.transfer + (inMap.get(a.id) ?? 0n);
      return { ...a, balance };
    });
  }

  async create(user: User, dto: CreateAccountDto) {
    const currency = await this.prisma.currency.findUnique({
      where: { code: dto.currencyCode },
    });
    if (!currency?.isActive) {
      throw new BadRequestException('account.unknownCurrency');
    }
    return this.prisma.account.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        name: dto.name,
        type: dto.type,
        currencyCode: dto.currencyCode,
        initialBalance: dto.initialBalance ?? 0n,
        cover: dto.cover ?? null,
      },
      include: { currency: true },
    });
  }

  async update(user: User, id: string, dto: UpdateAccountDto) {
    const account = await this.getOwned(user, id);
    return this.prisma.account.update({
      where: { id: account.id },
      data: {
        name: dto.name,
        type: dto.type,
        cover: dto.cover,
        initialBalance: dto.initialBalance,
        archivedAt: dto.archived === undefined ? undefined : dto.archived ? new Date() : null,
      },
      include: { currency: true },
    });
  }

  async remove(user: User, id: string) {
    const account = await this.getOwned(user, id);
    const txCount = await this.prisma.transaction.count({
      where: { OR: [{ accountId: id }, { toAccountId: id }] },
    });
    if (txCount > 0) {
      // On archive plutôt que supprimer pour préserver l'historique
      return this.prisma.account.update({
        where: { id },
        data: { archivedAt: new Date() },
        include: { currency: true },
      });
    }
    await this.prisma.account.delete({ where: { id } });
    return { deleted: true };
  }

  private async getOwned(user: User, id: string): Promise<Account> {
    const account = await this.prisma.account.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(account, user);
    return account!;
  }
}
