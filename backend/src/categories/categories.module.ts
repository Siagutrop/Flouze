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
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertAccess, visibleTo } from '../common/ownership';
import { PrismaService } from '../prisma/prisma.service';

class CategoryDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsBoolean()
  shared?: boolean;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@Injectable()
class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list(user: User) {
    return this.prisma.category.findMany({
      where: { householdId: user.householdId, ...visibleTo(user) },
      include: { owner: { select: { id: true, displayName: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(user: User, dto: CategoryDto) {
    return this.prisma.category.create({
      data: {
        householdId: user.householdId,
        ownerId: dto.shared ? null : user.id,
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
      },
    });
  }

  async update(user: User, id: string, dto: UpdateCategoryDto) {
    const cat = await this.prisma.category.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(cat, user);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(user: User, id: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, householdId: user.householdId },
    });
    assertAccess(cat, user);
    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }
}

@Controller('categories')
@UseGuards(JwtAuthGuard)
class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.categories.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CategoryDto) {
    return this.categories.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.categories.remove(user, id);
  }
}

@Module({ controllers: [CategoriesController], providers: [CategoriesService] })
export class CategoriesModule {}
