import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class UpdateMeDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  /** Code langue BCP 47 (fr, en…) — les packs de langue sont côté frontend */
  @IsOptional()
  @IsString()
  locale?: string;

  /** Avatar : émoji ou data-URL (image redimensionnée côté client) */
  @IsOptional()
  @IsString()
  avatarUrl?: string | null;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Patch('me')
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    const { passwordHash, ...rest } = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });
    return rest;
  }
}
