import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('currencies')
@UseGuards(JwtAuthGuard)
class CurrenciesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }
}

@Module({ controllers: [CurrenciesController] })
export class CurrenciesModule {}
