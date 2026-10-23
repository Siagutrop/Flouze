import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDefined, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BudgetsService } from './budgets.service';

class MonthQueryDto {
  @IsOptional() @IsInt() @Min(2000) @Transform(({ value }) => parseInt(value, 10)) year?: number;
  @IsOptional() @IsInt() @Min(1) @Max(12) @Transform(({ value }) => parseInt(value, 10)) month?: number;
}

class AllocationDto {
  @IsDefined()
  @Transform(({ value }) => BigInt(String(value)))
  allocated: bigint;
}

class TransferDto {
  @IsString() fromEnvelopeId: string;
  @IsString() toEnvelopeId: string;
  @IsDefined()
  @Transform(({ value }) => BigInt(String(value)))
  amount: bigint;
  @IsOptional() @IsString() note?: string;
}

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private budgets: BudgetsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() q: MonthQueryDto) {
    const now = new Date();
    return this.budgets.list(
      user,
      q.year ?? now.getUTCFullYear(),
      q.month ?? now.getUTCMonth() + 1,
    );
  }

  @Post('generate')
  generate(@CurrentUser() user: User, @Body() q: MonthQueryDto) {
    const now = new Date();
    return this.budgets.generateNow(
      user,
      q.year ?? now.getUTCFullYear(),
      q.month ?? now.getUTCMonth() + 1,
    );
  }

  @Patch(':id/lines/:envelopeId')
  setAllocation(
    @CurrentUser() user: User,
    @Param('id') periodId: string,
    @Param('envelopeId') envelopeId: string,
    @Body() dto: AllocationDto,
  ) {
    return this.budgets.setAllocation(user, periodId, envelopeId, dto.allocated);
  }

  @Post(':id/transfers')
  transfer(@CurrentUser() user: User, @Param('id') periodId: string, @Body() dto: TransferDto) {
    return this.budgets.transfer(user, periodId, dto);
  }

  @Post(':id/copy-previous')
  copyPrevious(@CurrentUser() user: User, @Param('id') periodId: string) {
    return this.budgets.copyPrevious(user, periodId);
  }

  @Post(':id/validate')
  validate(@CurrentUser() user: User, @Param('id') periodId: string) {
    return this.budgets.validate(user, periodId);
  }

  @Post(':id/close')
  close(@CurrentUser() user: User, @Param('id') periodId: string) {
    return this.budgets.close(user, periodId);
  }
}
