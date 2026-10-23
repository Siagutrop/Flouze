import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.accounts.list(user);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateAccountDto) {
    return this.accounts.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accounts.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.accounts.remove(user, id);
  }
}
