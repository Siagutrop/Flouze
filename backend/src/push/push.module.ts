import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IsObject, IsString } from 'class-validator';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import webpush from 'web-push';
import { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class SubscribeDto {
  @IsString()
  endpoint: string;

  @IsObject()
  keys: { p256dh: string; auth: string };
}

@Injectable()
class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapid: { publicKey: string; privateKey: string };

  constructor(private prisma: PrismaService) {
    this.vapid = this.loadVapid();
    webpush.setVapidDetails(
      'mailto:flouze@localhost',
      this.vapid.publicKey,
      this.vapid.privateKey,
    );
  }

  private loadVapid() {
    if (process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY) {
      return {
        publicKey: process.env.WEB_PUSH_PUBLIC_KEY,
        privateKey: process.env.WEB_PUSH_PRIVATE_KEY,
      };
    }
    const file = join(process.cwd(), '.vapid.json');
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, 'utf8'));
    }
    const keys = webpush.generateVAPIDKeys();
    try {
      writeFileSync(file, JSON.stringify(keys), 'utf8');
    } catch {
      this.logger.warn('Impossible de persister .vapid.json');
    }
    return keys;
  }

  get publicKey() {
    return this.vapid.publicKey;
  }

  async subscribe(user: User, dto: SubscribeDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId: user.id, keysJson: dto.keys },
      create: { userId: user.id, endpoint: dto.endpoint, keysJson: dto.keys },
    });
  }

  async unsubscribe(user: User, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });
    return { removed: true };
  }

  async isSubscribed(user: User) {
    return (
      (await this.prisma.pushSubscription.count({
        where: { userId: user.id },
      })) > 0
    );
  }

  @Cron('0 18 * * *')
  async sendInactivityReminders() {
    const cutoff = new Date(Date.now() - 2 * 86_400_000);
    const subs = await this.prisma.pushSubscription.findMany({
      include: { user: { select: { id: true, displayName: true } } },
    });
    const byUser = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = byUser.get(s.userId) ?? [];
      list.push(s);
      byUser.set(s.userId, list);
    }
    for (const [userId, userSubs] of byUser) {
      const last = await this.prisma.transaction.findFirst({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (last && last.createdAt > cutoff) continue;
      const days = last
        ? Math.floor((Date.now() - last.createdAt.getTime()) / 86_400_000)
        : null;
      const payload = JSON.stringify({
        title: 'Flouze',
        body: days
          ? `Aucune opération saisie depuis ${days} jours — un petit point ?`
          : 'Pense à saisir tes opérations du jour !',
        url: '/',
      });
      for (const s of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keysJson as any },
            payload,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: s.id } });
          } else {
            this.logger.warn(
              `Push échoué (${status}) pour ${s.endpoint.slice(0, 40)}…`,
            );
          }
        }
      }
    }
  }
}

@Controller('push')
@UseGuards(JwtAuthGuard)
class PushController {
  constructor(private push: PushService) {}

  @Get('vapid-key')
  vapidKey() {
    return { publicKey: this.push.publicKey };
  }

  @Get('status')
  status(@CurrentUser() user: User) {
    return this.push.isSubscribed(user).then((subscribed) => ({ subscribed }));
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: User, @Body() dto: SubscribeDto) {
    return this.push.subscribe(user, dto);
  }

  @Delete('subscribe')
  @HttpCode(200)
  unsubscribe(
    @CurrentUser() user: User,
    @Body('endpoint') endpoint: string,
  ) {
    return this.push.unsubscribe(user, endpoint);
  }
}

@Module({
  controllers: [PushController],
  providers: [PushService],
})
export class PushModule {}
