import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RP_NAME = 'Flouze';
const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const ORIGINS = (process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

@Injectable()
export class WebAuthnService {
  constructor(private prisma: PrismaService) {}

  async registerOptions(user: User) {
    const existing = await this.prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
    });
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: user.displayName,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: this.parseTransports(c.transports),
      })),
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { webauthnChallenge: options.challenge },
    });
    return options;
  }

  async registerVerify(user: User, body: { response: any; name?: string }) {
    if (!user.webauthnChallenge) {
      throw new BadRequestException('webauthn.noChallenge');
    }
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('webauthn.verifyFailed');
    }
    const { credential } = verification.registrationInfo;
    const created = await this.prisma.webAuthnCredential.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: JSON.stringify(credential.transports ?? []),
        name: body.name || 'Appareil',
      },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { webauthnChallenge: null },
    });
    return created;
  }

  listCredentials(user: User) {
    return this.prisma.webAuthnCredential.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeCredential(user: User, id: string) {
    await this.prisma.webAuthnCredential.deleteMany({
      where: { id, userId: user.id },
    });
    return { deleted: true };
  }

  async loginOptions(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { webauthnCredentials: true },
    });
    if (!user || user.webauthnCredentials.length === 0) {
      throw new BadRequestException('webauthn.noCredentials');
    }
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials: user.webauthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: this.parseTransports(c.transports),
      })),
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { webauthnChallenge: options.challenge },
    });
    return options;
  }

  async loginVerify(email: string, response: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { webauthnCredentials: true },
    });
    if (!user?.webauthnChallenge) {
      throw new UnauthorizedException('webauthn.noChallenge');
    }
    const cred = user.webauthnCredentials.find(
      (c) => c.credentialId === response.id,
    );
    if (!cred) {
      throw new UnauthorizedException('webauthn.unknownCredential');
    }
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.webauthnChallenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(cred.publicKey),
        counter: Number(cred.counter),
        transports: this.parseTransports(cred.transports),
      },
      requireUserVerification: false,
    });
    if (!verification.verified) {
      throw new UnauthorizedException('webauthn.verifyFailed');
    }
    await this.prisma.$transaction([
      this.prisma.webAuthnCredential.update({
        where: { id: cred.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { webauthnChallenge: null },
      }),
    ]);
    return user;
  }

  private parseTransports(raw: string | null) {
    try {
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }
}
