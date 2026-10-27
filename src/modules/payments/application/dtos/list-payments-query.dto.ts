import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaymentStatus } from '../../domain/entities/payment.entity';
import { trimString, uppercaseString } from './string-transformers';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por estado del pago',
    enum: PaymentStatus,
    enumName: 'PaymentStatus',
    example: PaymentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filtra por código ISO 4217 (se normaliza a mayúsculas)',
    example: 'USD',
    pattern: '^[A-Z]{3}$',
  })
  @IsOptional()
  @Transform(uppercaseString)
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO 4217 code',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filtra por identificador de cliente',
    example: 'customer-123',
    maxLength: 64,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Página solicitada (base 1)',
    example: 1,
    default: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de pagos por página',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
