import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { WebAuthnService } from './webauthn.service';

const REFRESH_COOKIE = 'flouze_refresh';
const ACCESS_COOKIE = 'flouze_access';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private webauthn: WebAuthnService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto);
    const tokens = await this.auth.login({
      email: dto.email,
      password: dto.password,
    });
    this.setCookies(res, tokens.accessToken, tokens.refreshToken);
    return this.publicUser(user);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto);
    this.setCookies(res, accessToken, refreshToken);
    return this.publicUser(user);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.auth.refresh(
      req.cookies?.[REFRESH_COOKIE],
    );
    this.setCookies(res, accessToken, refreshToken);
    return this.publicUser(user);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: User) {
    const full = await this.auth.me(user.id);
    return { ...this.publicUser(full!), household: full!.household };
  }

  // ── Passkeys / WebAuthn ─────────────────────────────────────────────────

  @Post('webauthn/register-options')
  @UseGuards(JwtAuthGuard)
  registerOptions(@CurrentUser() user: User) {
    return this.webauthn.registerOptions(user);
  }

  @Post('webauthn/register-verify')
  @UseGuards(JwtAuthGuard)
  registerVerify(
    @CurrentUser() user: User,
    @Body() body: { response: unknown; name?: string },
  ) {
    return this.webauthn.registerVerify(user, body);
  }

  @Get('webauthn/credentials')
  @UseGuards(JwtAuthGuard)
  listCredentials(@CurrentUser() user: User) {
    return this.webauthn.listCredentials(user);
  }

  @Delete('webauthn/credentials/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  removeCredential(@CurrentUser() user: User, @Param('id') id: string) {
    return this.webauthn.removeCredential(user, id);
  }

  @Post('webauthn/login-options')
  @HttpCode(200)
  loginOptions(@Body() body: { email: string }) {
    return this.webauthn.loginOptions(body.email);
  }

  @Post('webauthn/login-verify')
  @HttpCode(200)
  async loginVerify(
    @Body() body: { email: string; response: unknown },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.webauthn.loginVerify(body.email, body.response);
    const { accessToken, refreshToken } = await this.auth.issueSession(user);
    this.setCookies(res, accessToken, refreshToken);
    return this.publicUser(user);
  }

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const secure = process.env.COOKIE_SECURE === 'true';
    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private publicUser(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
