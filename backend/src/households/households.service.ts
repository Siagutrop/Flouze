import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInvitationDto,
  UpdateHouseholdDto,
} from './dto/update-household.dto';

@Injectable()
export class HouseholdsService {
  constructor(private prisma: PrismaService) {}

  get(householdId: string) {
    return this.prisma.household.findUnique({
      where: { id: householdId },
      include: {
        defaultCurrency: true,
        users: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            locale: true,
          },
        },
      },
    });
  }

  async update(user: User, dto: UpdateHouseholdDto) {
    this.requireOwner(user);
    if (dto.defaultCurrencyCode) {
      const currency = await this.prisma.currency.findUnique({
        where: { code: dto.defaultCurrencyCode },
      });
      if (!currency?.isActive) {
        throw new BadRequestException('household.unknownCurrency');
      }
    }
    return this.prisma.household.update({
      where: { id: user.householdId },
      data: dto,
    });
  }

  async invite(user: User, dto: CreateInvitationDto) {
    this.requireOwner(user);
    const alreadyMember = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (alreadyMember)
      throw new BadRequestException('household.alreadyMember');
    return this.prisma.invitation.create({
      data: {
        householdId: user.householdId,
        email: dto.email.toLowerCase(),
        token: randomBytes(32).toString('base64url'),
        createdById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  listInvitations(user: User) {
    this.requireOwner(user);
    return this.prisma.invitation.findMany({
      where: { householdId: user.householdId, acceptedAt: null },
    });
  }

  async removeMember(user: User, memberId: string) {
    this.requireOwner(user);
    if (memberId === user.id) {
      throw new BadRequestException('household.cannotRemoveSelf');
    }
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
    });
    if (!member || member.householdId !== user.householdId) {
      throw new NotFoundException('household.memberNotFound');
    }
    await this.prisma.user.delete({ where: { id: memberId } });
  }

  private requireOwner(user: User) {
    if (user.role !== Role.OWNER) {
      throw new ForbiddenException('household.ownerOnly');
    }
  }
}
