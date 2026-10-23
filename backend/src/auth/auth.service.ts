import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      if (dto.invitationToken) {
        return await this.registerViaInvitation(dto, passwordHash);
      }

      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          displayName: dto.displayName,
          role: Role.OWNER,
          household: {
            create: { name: dto.householdName || `Foyer de ${dto.displayName}` },
          },
        },
      });
      return user;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('auth.emailTaken');
      }
      throw e;
    }
  }

  private async registerViaInvitation(dto: RegisterDto, passwordHash: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.invitationToken },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt < new Date() ||
      invitation.email.toLowerCase() !== dto.email.toLowerCase()
    ) {
      throw new BadRequestException('auth.invalidInvitation');
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          displayName: dto.displayName,
          role: Role.MEMBER,
          householdId: invitation.householdId,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('auth.invalidCredentials');
    }
    return this.issueTokens(user);
  }

  /** Rotation du refresh token : l'ancien est révoqué, un nouveau est émis. */
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('auth.noRefreshToken');
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('auth.invalidRefreshToken');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user);
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Émission d'une session complète (passkey, etc.). */
  async issueSession(user: User) {
    return this.issueTokens(user);
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        household: { include: { defaultCurrency: true } },
      },
    });
  }

  private async issueTokens(user: User) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, hid: user.householdId },
      { secret: process.env.JWT_SECRET, expiresIn: ACCESS_TTL },
    );
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return { user, accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
