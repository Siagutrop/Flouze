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
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TransactionType, User } from '@prisma/client';
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

class TxTemplateDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: TransactionType;

  @IsOptional()
  @Transform(toBigInt)
  amount?: bigint;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  envelopeId?: string;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

class UpdateTxTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsIn(['EXPENSE', 'INCOME'])
  type?: TransactionType;

  @IsOptional()
  @Transform(toBigInt)
  amount?: bigint;

  @IsOptional()
  @IsString()
  accountId?: string | null;

  @IsOptional()
  @IsString()
  envelopeId?: string | null;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;
}

const INCLUDE = {
  account: { select: { id: true, name: true } },
  envelope: { select: { id: true, name: true, icon: true } },
} as const;

@Injectable()
class TxTemplatesService {
  constructor(private prisma: PrismaService) {}

  list(user: User) {
    return this.prisma.txTemplate.findMany({
      where: { householdId: user.householdId, ...visibleTo(user) },
      include: INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(user: User, dto: TxTemplateDto) {
    return this.prisma.txTemplate.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        label: dto.label,
        type: dto.type ?? 'EXPENSE',
        amount: dto.amount ?? 0n,
        accountId: dto.accountId ?? null,
        envelopeId: dto.envelopeId ?? null,
        mandatory: dto.mandatory ?? false,
      },
      include: INCLUDE,
    });
  }

  async update(user: User, id: string, dto: UpdateTxTemplateDto) {
    const tpl = await this.prisma.txTemplate.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(tpl, user);
    return this.prisma.txTemplate.update({
      where: { id },
      data: {
        label: dto.label,
        type: dto.type,
        amount: dto.amount,
        accountId: dto.accountId,
        envelopeId: dto.envelopeId,
        mandatory: dto.mandatory,
      },
    });
  }

  async remove(user: User, id: string) {
    const tpl = await this.prisma.txTemplate.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(tpl, user);
    await this.prisma.txTemplate.delete({ where: { id } });
    return { deleted: true };
  }
}

@Controller('tx-templates')
@UseGuards(JwtAuthGuard)
class TxTemplatesController {
  constructor(private templates: TxTemplatesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.templates.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: TxTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateTxTemplateDto,
  ) {
    return this.templates.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.templates.remove(user, id);
  }
}

@Module({ controllers: [TxTemplatesController], providers: [TxTemplatesService] })
export class TxTemplatesModule {}
