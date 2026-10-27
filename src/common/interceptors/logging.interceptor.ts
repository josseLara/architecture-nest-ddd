import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs method, path, status and duration. It deliberately never logs bodies or
 * headers, since payment payloads contain sensitive data.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`,
          );
        },
        error: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : 'Unknown error';

          this.logger.warn(
            `${method} ${originalUrl} failed after ${Date.now() - startedAt}ms: ${message}`,
          );
        },
      }),
    );
  }
}
