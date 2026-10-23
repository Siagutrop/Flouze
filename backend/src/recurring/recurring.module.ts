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
import { Frequency, RecurringKind, User } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
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

class RecurringDto {
  @IsIn(Object.values(RecurringKind))
  kind: RecurringKind;

  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  envelopeId?: string;

  @IsDefined()
  @Transform(toBigInt)
  amount: bigint;

  @IsString()
  @MinLength(1)
  label: string;

  /** Icône : clé de marque (netflix…), émoji ou data-URL */
  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsIn(Object.values(Frequency))
  frequency?: Frequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Charge obligatoire (loyer, factures…) */
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  /** Abonnement : affiché dans l'onglet dédié */
  @IsOptional()
  @IsBoolean()
  isSubscription?: boolean;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

class UpdateRecurringDto {
  @IsOptional() @IsString() @MinLength(1) label?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @Transform(toBigInt) amount?: bigint;
  @IsOptional() @IsIn(Object.values(Frequency)) frequency?: Frequency;
  @IsOptional() @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() envelopeId?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsBoolean() mandatory?: boolean;
  @IsOptional() @IsBoolean() isSubscription?: boolean;
}

@Injectable()
class RecurringService {
  constructor(private prisma: PrismaService) {}

  list(user: User) {
    return this.prisma.recurringTemplate.findMany({
      where: { householdId: user.householdId, ...visibleTo(user) },
      include: {
        account: { select: { id: true, name: true } },
        envelope: { select: { id: true, name: true } },
        owner: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(user: User, dto: RecurringDto) {
    await this.checkRefs(user, dto.accountId, dto.envelopeId);
    return this.prisma.recurringTemplate.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        kind: dto.kind,
        accountId: dto.accountId,
        envelopeId: dto.envelopeId ?? null,
        amount: dto.amount,
        label: dto.label,
        icon: dto.icon ?? null,
        mandatory: dto.mandatory ?? false,
        isSubscription: dto.isSubscription ?? false,
        frequency: dto.frequency ?? Frequency.MONTHLY,
        dayOfMonth: dto.dayOfMonth,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async update(user: User, id: string, dto: UpdateRecurringDto) {
    const t = await this.getOwned(user, id);
    if (dto.accountId || dto.envelopeId) {
      await this.checkRefs(user, dto.accountId ?? t.accountId, dto.envelopeId ?? t.envelopeId);
    }
    return this.prisma.recurringTemplate.update({
      where: { id },
      data: {
        ...dto,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(user: User, id: string) {
    await this.getOwned(user, id);
    await this.prisma.recurringTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  private async getOwned(user: User, id: string) {
    const t = await this.prisma.recurringTemplate.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(t, user);
    return t!;
  }

  private async checkRefs(user: User, accountId: string, envelopeId?: string | null) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, householdId: user.householdId, archivedAt: null },
    });
    try {
      assertAccess(account, user);
    } catch {
      throw new BadRequestException('recurring.unknownAccount');
    }
    if (envelopeId) {
      const env = await this.prisma.envelope.findFirst({
        where: { id: envelopeId, householdId: user.householdId, archivedAt: null },
      });
      try {
        assertAccess(env, user);
      } catch {
        throw new BadRequestException('recurring.unknownEnvelope');
      }
    }
  }
}

@Controller('recurring')
@UseGuards(JwtAuthGuard)
class RecurringController {
  constructor(private recurring: RecurringService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.recurring.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: RecurringDto) {
    return this.recurring.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateRecurringDto) {
    return this.recurring.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.recurring.remove(user, id);
  }
}

@Module({ controllers: [RecurringController], providers: [RecurringService] })
export class RecurringModule {}
