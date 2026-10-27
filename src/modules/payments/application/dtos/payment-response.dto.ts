import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Payment, PaymentStatus } from '../../domain/entities/payment.entity';
import { PaginatedPayments } from '../../domain/repositories/payment.repository';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Identificador único del pago',
    format: 'uuid',
    example: '65e23d30-b548-4955-8e8f-e24d3a650bd8',
  })
  readonly id: string;

  @ApiProperty({
    description: 'Referencia única de negocio',
    example: 'PAY-2026-0001',
  })
  readonly reference: string;

  @ApiProperty({
    description: 'Identificador del cliente',
    example: 'customer-123',
  })
  readonly customerId: string;

  @ApiProperty({
    description: 'Importe decimal en la moneda indicada',
    example: 150.75,
  })
  readonly amount: number;

  @ApiProperty({
    description: 'Código ISO 4217',
    example: 'USD',
  })
  readonly currency: string;

  @ApiProperty({
    description: 'Estado actual del pago',
    enum: PaymentStatus,
    enumName: 'PaymentStatus',
    example: PaymentStatus.PENDING,
  })
  readonly status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Descripción libre del pago',
    example: 'Suscripción anual',
  })
  readonly description?: string;

  @ApiProperty({
    description: 'Fecha de creación (ISO 8601)',
    format: 'date-time',
    example: '2026-10-26T20:45:05.299Z',
  })
  readonly createdAt: string;

  @ApiProperty({
    description: 'Fecha de la última modificación (ISO 8601)',
    format: 'date-time',
    example: '2026-10-26T20:45:05.299Z',
  })
  readonly updatedAt: string;

  @ApiPropertyOptional({
    description: 'Fecha de aprobación; solo en pagos aprobados',
    format: 'date-time',
    example: '2026-10-26T20:45:05.359Z',
  })
  readonly approvedAt?: string;

  @ApiPropertyOptional({
    description: 'Fecha de rechazo; solo en pagos rechazados',
    format: 'date-time',
    example: '2026-10-26T20:45:05.359Z',
  })
  readonly rejectedAt?: string;

  @ApiPropertyOptional({
    description: 'Motivo del rechazo; solo en pagos rechazados',
    example: 'Sospecha de fraude',
  })
  readonly rejectionReason?: string;

  private constructor(payment: Payment) {
    this.id = payment.id.toString();
    this.reference = payment.reference;
    this.customerId = payment.customerId;
    this.amount = payment.money.toDecimal();
    this.currency = payment.money.currency;
    this.status = payment.status;
    this.description = payment.description;
    this.createdAt = payment.createdAt.toISOString();
    this.updatedAt = payment.updatedAt.toISOString();
    this.approvedAt = payment.approvedAt?.toISOString();
    this.rejectedAt = payment.rejectedAt?.toISOString();
    this.rejectionReason = payment.rejectionReason;
  }

  static fromDomain(payment: Payment): PaymentResponseDto {
    return new PaymentResponseDto(payment);
  }
}

export class PaginationMetaDto {
  @ApiProperty({ description: 'Página actual (base 1)', example: 1 })
  readonly page: number;

  @ApiProperty({ description: 'Cantidad de elementos por página', example: 10 })
  readonly limit: number;

  @ApiProperty({
    description: 'Total de pagos que cumplen el filtro',
    example: 42,
  })
  readonly total: number;

  @ApiProperty({ description: 'Cantidad total de páginas', example: 5 })
  readonly totalPages: number;

  constructor(page: number, limit: number, total: number, totalPages: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    this.totalPages = totalPages;
  }
}

export class PaginatedPaymentsResponseDto {
  @ApiProperty({
    description: 'Página de pagos',
    type: [PaymentResponseDto],
  })
  readonly data: PaymentResponseDto[];

  @ApiProperty({
    description: 'Metadatos de paginación',
    type: PaginationMetaDto,
  })
  readonly meta: PaginationMetaDto;

  private constructor(data: PaymentResponseDto[], meta: PaginationMetaDto) {
    this.data = data;
    this.meta = meta;
  }

  static fromResult(result: PaginatedPayments): PaginatedPaymentsResponseDto {
    return new PaginatedPaymentsResponseDto(
      result.items.map((payment) => PaymentResponseDto.fromDomain(payment)),
      new PaginationMetaDto(
        result.page,
        result.limit,
        result.total,
        Math.ceil(result.total / result.limit),
      ),
    );
  }
}
