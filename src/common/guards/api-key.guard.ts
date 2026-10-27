import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const API_KEY_HEADER = 'x-api-key';

/**
 * Optional API-key protection.
 *
 * The guard is a no-op when API_KEY is not configured, which keeps local
 * development frictionless. Set API_KEY in production to require the header on
 * every non-@Public route.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const configuredApiKey = this.configService.get<string>('app.apiKey');

    if (!configuredApiKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedApiKey = request.header(API_KEY_HEADER);

    if (!providedApiKey || !this.safeEqual(providedApiKey, configuredApiKey)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }

  private safeEqual(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
