import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { resolveClientIp } from '../common/client-ip.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { ResponseDto } from '../common/dto/response.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../common/strategies/jwt.strategy.js';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  LOGIN_THROTTLE_LIMIT,
  LOGIN_THROTTLE_TTL_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
} from '../common/variables.global.js';
import type { MeResponseDto } from './dto/out/me-response.dto.js';
import { AuthExceptionFilter } from './filter/auth-exception.filter.js';
import { AuthMapper } from './mapper/auth.mapper.js';
import {
  AuthService,
  type RequestContext,
  type TokenPair,
} from './services/auth.service.js';

const AUTH_THROTTLE = {
  default: { limit: LOGIN_THROTTLE_LIMIT, ttl: LOGIN_THROTTLE_TTL_MS },
};

@ApiTags('Auth')
@Controller('auth')
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Se connecter (email, mot de passe, Turnstile)' })
  @ApiOkResponse({ description: 'Tokens déposés en cookies httpOnly.' })
  @ApiUnauthorizedResponse({
    description: 'Email ou mot de passe incorrect.',
    type: ErrorResponseDto,
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives.' })
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ResponseDto<null>> {
    const tokens = await this.authService.login(body, contextOf(req));
    setAuthCookies(res, tokens);
    return new ResponseDto(null);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: "Rafraîchir le token d'accès" })
  @ApiUnauthorizedResponse({
    description: 'Refresh token manquant ou invalide.',
    type: ErrorResponseDto,
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ResponseDto<null>> {
    const accessToken = await this.authService.refresh(
      req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      cookieOptions(ACCESS_TOKEN_MAX_AGE_MS),
    );
    return new ResponseDto(null);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se déconnecter' })
  logout(@Res({ passthrough: true }) res: Response): ResponseDto<null> {
    res.clearCookie(ACCESS_TOKEN_COOKIE, cookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions());
    return new ResponseDto(null);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Compte connecté' })
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResponseDto<MeResponseDto>> {
    return AuthMapper.toMeResponse(await this.authService.me(user.id));
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Changer le mot de passe (déconnecte les autres sessions)',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ResponseDto<null>> {
    const tokens = await this.authService.changePassword(
      user.id,
      body,
      contextOf(req),
    );
    setAuthCookies(res, tokens);
    return new ResponseDto(null);
  }
}

function contextOf(req: Request): RequestContext {
  return {
    ip: resolveClientIp(req),
    userAgent: req.headers['user-agent'],
  };
}

function setAuthCookies(res: Response, tokens: TokenPair): void {
  res.cookie(
    ACCESS_TOKEN_COOKIE,
    tokens.accessToken,
    cookieOptions(ACCESS_TOKEN_MAX_AGE_MS),
  );
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    cookieOptions(REFRESH_TOKEN_MAX_AGE_MS),
  );
}

function cookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: isServedOverHttps(),
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

function isServedOverHttps(): boolean {
  return (
    process.env.PUBLIC_URL?.trim().toLowerCase().startsWith('https://') ?? false
  );
}
