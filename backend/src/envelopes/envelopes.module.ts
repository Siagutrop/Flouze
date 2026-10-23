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
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
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

class EnvelopeDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /** Seuil d'alerte (unités mineures) : notifie quand le disponible passe sous */
  @IsOptional()
  @Transform(toBigInt)
  alertThreshold?: bigint | null;

  /** true = enveloppe du foyer ; false/absent = personnelle */
  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

class UpdateEnvelopeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /** Fond visuel : clé de dégradé (cover:…) ou data-URL */
  @IsOptional()
  @IsString()
  cover?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Transform(toBigInt)
  alertThreshold?: bigint | null;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

@Injectable()
class EnvelopesService {
  constructor(private prisma: PrismaService) {}

  list(user: User) {
    return this.prisma.envelope.findMany({
      where: { householdId: user.householdId, archivedAt: null, ...visibleTo(user) },
      include: {
        category: true,
        owner: { select: { id: true, displayName: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(user: User, dto: EnvelopeDto) {
    const ownerId = dto.shared ? null : user.id;
    if (dto.categoryId) await this.checkCategory(user, dto.categoryId);
    return this.prisma.envelope.create({
      data: {
        householdId: user.householdId,
        ownerId,
        name: dto.name,
        categoryId: dto.categoryId ?? null,
        icon: dto.icon,
        color: dto.color,
        alertThreshold: dto.alertThreshold ?? null,
      },
      include: { category: true },
    });
  }

  async update(user: User, id: string, dto: UpdateEnvelopeDto) {
    const env = await this.prisma.envelope.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(env, user);
    if (dto.categoryId) await this.checkCategory(user, dto.categoryId);
    return this.prisma.envelope.update({
      where: { id },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        icon: dto.icon,
        color: dto.color,
        cover: dto.cover,
        alertThreshold: dto.alertThreshold,
        isFavorite: dto.isFavorite,
        sortOrder: dto.sortOrder,
        archivedAt:
          dto.archived === undefined ? undefined : dto.archived ? new Date() : null,
      },
      include: { category: true },
    });
  }

  async remove(user: User, id: string) {
    const env = await this.prisma.envelope.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(env, user);
    const used = await this.prisma.transaction.count({ where: { envelopeId: id } });
    if (used > 0) {
      // archive pour préserver l'historique
      return this.prisma.envelope.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
    }
    await this.prisma.envelope.delete({ where: { id } });
    return { deleted: true };
  }

  /** Une catégorie doit appartenir au même périmètre (perso/foyer) que l'enveloppe. */
  private async checkCategory(user: User, categoryId: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id: categoryId, householdId: user.householdId },
    });
    try {
      assertAccess(cat, user);
    } catch {
      throw new BadRequestException('envelope.unknownCategory');
    }
  }
}

@Controller('envelopes')
@UseGuards(JwtAuthGuard)
class EnvelopesController {
  constructor(private envelopes: EnvelopesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.envelopes.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: EnvelopeDto) {
    return this.envelopes.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateEnvelopeDto) {
    return this.envelopes.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.envelopes.remove(user, id);
  }
}

@Module({ controllers: [EnvelopesController], providers: [EnvelopesService] })
export class EnvelopesModule {}
