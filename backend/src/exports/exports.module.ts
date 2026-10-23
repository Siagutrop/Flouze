import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Injectable,
  Module,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { Response } from 'express';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertAccess, visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.module';

class ExportQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

/** Parseur CSV minimal (séparateur , ; ou \t auto-détecté, quotes "…" gérées). */
function parseCsv(text: string): string[][] {
  const firstLine = text.split('\n', 1)[0];
  const sep = firstLine.includes(';')
    ? ';'
    : firstLine.includes('\t')
      ? '\t'
      : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === sep) {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

@Injectable()
class ExportsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  async transactionsCsv(user: User, q: ExportQueryDto) {
    const txs = await this.prisma.transaction.findMany({
      where: {
        account: { householdId: user.householdId, ...visibleTo(user) },
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
        account: { select: { name: true, currencyCode: true, currency: true } },
        envelope: { select: { name: true } },
        toAccount: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });
    const esc = (s: string | null | undefined) =>
      `"${(s ?? '').replace(/"/g, '""')}"`;
    const lines = ['date;type;compte;vers_compte;enveloppe;libelle;montant;note'];
    for (const t of txs) {
      const minor = t.account.currency?.minorUnits ?? 2;
      const value = (Number(t.amount) / 10 ** minor).toFixed(minor);
      const signed =
        t.type === 'EXPENSE' ? `-${value}` : t.type === 'INCOME' ? value : value;
      lines.push(
        [
          t.date.toISOString().slice(0, 10),
          t.type,
          esc(t.account.name),
          esc(t.toAccount?.name),
          esc(t.envelope?.name),
          esc(t.label),
          signed,
          esc(t.note),
        ].join(';'),
      );
    }
    return '﻿' + lines.join('\r\n'); // BOM pour Excel
  }

  /** Export complet du foyer (backup JSON lisible). */
  async backupJson(user: User) {
    const hid = user.householdId;
    const [household, users, accounts, categories, envelopes, transactions, recurring, credits, goals, periods, transfers] =
      await Promise.all([
        this.prisma.household.findUnique({ where: { id: hid } }),
        this.prisma.user.findMany({
          where: { householdId: hid },
          select: { id: true, email: true, displayName: true, role: true, locale: true },
        }),
        this.prisma.account.findMany({ where: { householdId: hid } }),
        this.prisma.category.findMany({ where: { householdId: hid } }),
        this.prisma.envelope.findMany({ where: { householdId: hid } }),
        this.prisma.transaction.findMany({ where: { householdId: hid } }),
        this.prisma.recurringTemplate.findMany({ where: { householdId: hid } }),
        this.prisma.credit.findMany({ where: { householdId: hid } }),
        this.prisma.savingsGoal.findMany({ where: { householdId: hid } }),
        this.prisma.budgetPeriod.findMany({
          where: { householdId: hid },
          include: { lines: true },
        }),
        this.prisma.envelopeTransfer.findMany({ where: { householdId: hid } }),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      household,
      users,
      accounts,
      categories,
      envelopes,
      transactions,
      recurring,
      credits,
      goals,
      budgetPeriods: periods,
      envelopeTransfers: transfers,
    };
  }

  /**
   * Import CSV : détecte les colonnes date / libellé / montant (ou débit+crédit).
   * Signe négatif → dépense, positif → revenu.
   */
  async importTransactions(
    user: User,
    accountId: string,
    file: { buffer: Buffer },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, householdId: user.householdId, archivedAt: null },
      include: { currency: true },
    });
    try {
      assertAccess(account, user);
    } catch {
      throw new BadRequestException('import.unknownAccount');
    }
    const minorUnits = account!.currency.minorUnits;

    const rows = parseCsv(file.buffer.toString('utf8'));
    if (rows.length < 2) throw new BadRequestException('import.emptyFile');
    const header = rows[0].map(normalizeHeader);
    const col = (...names: string[]) =>
      header.findIndex((h) => names.some((n) => h.includes(n)));
    const iDate = col('date', 'operation');
    const iLabel = col('libelle', 'label', 'description', 'operation');
    const iAmount = col('montant', 'amount', 'valeur');
    const iDebit = col('debit', 'retrait');
    const iCredit = col('credit', 'depot');
    const iNote = col('note', 'commentaire', 'detail');
    if (iDate < 0 || iLabel < 0 || (iAmount < 0 && (iDebit < 0 || iCredit < 0))) {
      throw new BadRequestException('import.unrecognizedColumns');
    }

    const parseAmount = (raw: string): bigint | null => {
      const n = raw.replace(/\s|€|EUR/gi, '').replace(',', '.');
      if (!/^-?\d+(\.\d+)?$/.test(n)) return null;
      const [i, d = ''] = n.replace('-', '').split('.');
      const v =
        BigInt(i || '0') * 10n ** BigInt(minorUnits) +
        BigInt((d + '00').slice(0, minorUnits) || '0');
      return n.startsWith('-') ? -v : v;
    };
    const parseDate = (raw: string): Date | null => {
      const d1 = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (d1) return new Date(Date.UTC(+d1[1], +d1[2] - 1, +d1[3]));
      const d2 = raw.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})/);
      if (d2) return new Date(Date.UTC(+d2[3], +d2[2] - 1, +d2[1]));
      return null;
    };

    const toCreate: import('@prisma/client').Prisma.TransactionCreateManyInput[] = [];
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const date = parseDate(r[iDate] ?? '');
      const label = (r[iLabel] ?? '').trim();
      let amount: bigint | null = null;
      if (iAmount >= 0) amount = parseAmount(r[iAmount] ?? '');
      else {
        const d = parseAmount(r[iDebit] ?? '0');
        const c = parseAmount(r[iCredit] ?? '0');
        if (d !== null || c !== null) amount = (c ?? 0n) - (d ?? 0n);
      }
      if (!date || !label || amount === null || amount === 0n) {
        skipped++;
        continue;
      }
      toCreate.push({
        householdId: user.householdId,
        accountId,
        type: amount < 0n ? 'EXPENSE' : 'INCOME',
        amount: amount < 0n ? -amount : amount,
        label,
        note: iNote >= 0 ? r[iNote] : null,
        date,
        createdById: user.id,
      });
    }
    if (!toCreate.length) throw new BadRequestException('import.noValidRows');
    await this.prisma.transaction.createMany({ data: toCreate });
    await this.prisma.auditLog.create({
      data: {
        householdId: user.householdId,
        userId: user.id,
        action: 'import.transactions',
        entityType: 'account',
        entityId: accountId,
        metadata: { imported: toCreate.length, skipped },
      },
    });
    this.realtime.emit(user.householdId);
    return { imported: toCreate.length, skipped };
  }
}

@Controller()
@UseGuards(JwtAuthGuard)
class ExportsController {
  constructor(private exports: ExportsService) {}

  @Get('export/transactions.csv')
  async csv(@CurrentUser() user: User, @Query() q: ExportQueryDto, @Res() res: Response) {
    const body = await this.exports.transactionsCsv(user, q);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="flouze-transactions.csv"',
    });
    res.send(body);
  }

  @Get('export/backup.json')
  async backup(@CurrentUser() user: User, @Res() res: Response) {
    const body = await this.exports.backupJson(user);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="flouze-backup.json"',
    });
    res.send(JSON.stringify(body, null, 2));
  }

  @Post('import/transactions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  importCsv(
    @CurrentUser() user: User,
    @Query('accountId') accountId: string,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('import.noFile');
    if (!accountId) throw new BadRequestException('import.accountRequired');
    return this.exports.importTransactions(user, accountId, file);
  }
}

@Module({ controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
