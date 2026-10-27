import { ApiProperty } from '@nestjs/swagger';

/**
 * Uniform error payload returned by AllExceptionsFilter.
 * Documented here so every endpoint can reference the same schema.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 409,
  })
  readonly statusCode!: number;

  @ApiProperty({
    description: 'HTTP reason phrase',
    example: 'Conflict',
  })
  readonly error!: string;

  @ApiProperty({
    description: 'Stable, machine-readable business error code',
    example: 'INVALID_PAYMENT_STATE_TRANSITION',
  })
  readonly code!: string;

  @ApiProperty({
    description:
      'Human-readable message. Validation failures return an array of messages.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Payment "..." cannot be approved while its status is "approved"',
  })
  readonly message!: string | string[];

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/api/payments/65e23d30-b548-4955-8e8f-e24d3a650bd8/approve',
  })
  readonly path!: string;

  @ApiProperty({
    description: 'Error timestamp in ISO 8601 format',
    format: 'date-time',
    example: '2026-10-26T20:45:12.745Z',
  })
  readonly timestamp!: string;
}
