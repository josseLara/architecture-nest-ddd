import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { ApplicationError } from '../../modules/payments/application/errors/application.error';
import { DomainError } from '../../modules/payments/domain/errors/domain.error';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

const STATUS_BY_DOMAIN_CODE: Record<string, number> = {
  PAYMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAYMENT_REFERENCE_ALREADY_EXISTS: HttpStatus.CONFLICT,
  INVALID_PAYMENT_STATE_TRANSITION: HttpStatus.CONFLICT,
  INVALID_MONEY: HttpStatus.BAD_REQUEST,
  INVALID_PAYMENT_ID: HttpStatus.BAD_REQUEST,
  INVALID_PAYMENT: HttpStatus.BAD_REQUEST,
};

const ERROR_LABELS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Last-resort exception filter.
 *
 * Keeps HTTP concerns out of the domain: DomainError and ApplicationError only
 * expose a business `code`, which is translated to a status code here.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const path = String(httpAdapter.getRequestUrl(request));

    const { statusCode, error, code, message } = this.describe(exception);

    const body: ErrorResponseBody = {
      statusCode,
      error,
      code,
      message,
      path,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${path} -> ${statusCode} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    httpAdapter.reply(context.getResponse(), body, statusCode);
  }

  private describe(exception: unknown): {
    statusCode: number;
    error: string;
    code: string;
    message: string | string[];
  } {
    if (exception instanceof DomainError) {
      const statusCode =
        STATUS_BY_DOMAIN_CODE[exception.code] ??
        HttpStatus.UNPROCESSABLE_ENTITY;

      return {
        statusCode,
        error: this.errorLabel(statusCode),
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof ApplicationError) {
      const statusCode =
        STATUS_BY_DOMAIN_CODE[exception.code] ?? HttpStatus.BAD_REQUEST;

      return {
        statusCode,
        error: this.errorLabel(statusCode),
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      return this.describeHttpException(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    };
  }

  private describeHttpException(exception: HttpException): {
    statusCode: number;
    error: string;
    code: string;
    message: string | string[];
  } {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();

    let message: string | string[] = exception.message;
    let error = this.errorLabel(statusCode);
    let code = `HTTP_${statusCode}`;

    if (typeof response === 'string') {
      message = response;
    } else if (typeof response === 'object' && response !== null) {
      const payload = response as Record<string, unknown>;
      const payloadMessage = payload.message;

      if (Array.isArray(payloadMessage)) {
        message = payloadMessage.map((item) => String(item));
        error = 'Bad Request';
        code = 'VALIDATION_ERROR';
      } else if (typeof payloadMessage === 'string') {
        message = payloadMessage;
      }

      if (typeof payload.error === 'string') {
        error = payload.error;
      }
    }

    return { statusCode, error, code, message };
  }

  private errorLabel(statusCode: number): string {
    return ERROR_LABELS[statusCode] ?? 'Error';
  }
}
