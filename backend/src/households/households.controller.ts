import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateInvitationDto,
  UpdateHouseholdDto,
} from './dto/update-household.dto';
import { HouseholdsService } from './households.service';

@Controller('household')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(private households: HouseholdsService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.households.get(user.householdId);
  }

  @Patch()
  update(@CurrentUser() user: User, @Body() dto: UpdateHouseholdDto) {
    return this.households.update(user, dto);
  }

  @Post('invitations')
  invite(@CurrentUser() user: User, @Body() dto: CreateInvitationDto) {
    return this.households.invite(user, dto);
  }

  @Get('invitations')
  listInvitations(@CurrentUser() user: User) {
    return this.households.listInvitations(user);
  }

  @Delete('members/:id')
  removeMember(@CurrentUser() user: User, @Param('id') id: string) {
    return this.households.removeMember(user, id);
  }
}
