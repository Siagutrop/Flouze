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
  IsNumber,
  IsOptional,
  IsString,
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

class CreditDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsDefined()
  @Transform(toBigInt)
  principal: bigint;

  @IsOptional()
  @IsNumber()
  @Min(0)
  annualRatePercent?: number;

  @IsDefined()
  @Transform(toBigInt)
  monthlyPayment: bigint;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;

  /** Fond visuel : clé de dégradé (cover:…) ou data-URL */
  @IsOptional()
  @IsString()
  cover?: string;
}

class UpdateCreditDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @Transform(toBigInt) monthlyPayment?: bigint;
  @IsOptional() @IsNumber() @Min(0) annualRatePercent?: number;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() cover?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsDateString() startDate?: string;
}

@Injectable()
class CreditsService {
  constructor(private prisma: PrismaService) {}

  async list(user: User) {
    const credits = await this.prisma.credit.findMany({
      where: { householdId: user.householdId, ...visibleTo(user) },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return credits.map((c) => ({ ...c, ...this.projection(c) }));
  }

  /** Projection du capital restant : mensualités échues × montant, borné au principal. */
  private projection(c: {
    principal: bigint;
    monthlyPayment: bigint;
    startDate: Date;
    endDate: Date | null;
  }) {
    const now = new Date();
    const monthsElapsed =
      (now.getUTCFullYear() - c.startDate.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - c.startDate.getUTCMonth());
    const paid = BigInt(Math.max(0, monthsElapsed)) * c.monthlyPayment;
    const remaining = c.principal - paid < 0n ? 0n : c.principal - paid;
    const totalMonths =
      c.monthlyPayment > 0n ? Number((c.principal + c.monthlyPayment - 1n) / c.monthlyPayment) : null;
    return { remainingPrincipal: remaining, estimatedMonths: totalMonths };
  }

  create(user: User, dto: CreditDto) {
    return this.prisma.credit.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        name: dto.name,
        accountId: dto.accountId ?? null,
        principal: dto.principal,
        annualRatePercent: dto.annualRatePercent ?? 0,
        monthlyPayment: dto.monthlyPayment,
        cover: dto.cover ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async update(user: User, id: string, dto: UpdateCreditDto) {
    const c = await this.prisma.credit.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(c, user);
    return this.prisma.credit.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:
          dto.endDate === undefined || dto.endDate === null
            ? dto.endDate === null
              ? null
              : undefined
            : new Date(dto.endDate),
      },
    });
  }

  async remove(user: User, id: string) {
    const c = await this.prisma.credit.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(c, user);
    await this.prisma.credit.delete({ where: { id } });
    return { deleted: true };
  }
}

@Controller('credits')
@UseGuards(JwtAuthGuard)
class CreditsController {
  constructor(private credits: CreditsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.credits.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreditDto) {
    return this.credits.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateCreditDto) {
    return this.credits.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.credits.remove(user, id);
  }
}

@Module({ controllers: [CreditsController], providers: [CreditsService] })
export class CreditsModule {}
