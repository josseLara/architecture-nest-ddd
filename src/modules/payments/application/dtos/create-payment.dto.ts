import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { trimString, uppercaseString } from './string-transformers';

export class CreatePaymentDto {
  @ApiProperty({
    description:
      'Referencia única de negocio. Si ya existe, la API responde 409.',
    example: 'PAY-2026-0001',
    minLength: 3,
    maxLength: 64,
    pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$',
  })
  @IsString()
  @Length(3, 64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/, {
    message:
      'reference must start with a letter or number and contain only letters, numbers, hyphens or underscores',
  })
  reference!: string;

  @ApiProperty({
    description: 'Identificador del cliente que origina el pago',
    example: 'customer-123',
    minLength: 1,
    maxLength: 64,
  })
  @Transform(trimString)
  @IsString()
  @Length(1, 64)
  customerId!: string;

  @ApiProperty({
    description:
      'Importe decimal. Se convierte a unidades mínimas (centavos) y admite como máximo dos decimales.',
    example: 150.75,
    minimum: 0.01,
    maximum: 1_000_000_000,
    type: Number,
  })
  @IsNumber(
    { allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 },
    { message: 'amount must be a number with at most two decimal places' },
  )
  @Min(0.01)
  @Max(1_000_000_000)
  amount!: number;

  @ApiProperty({
    description: 'Código de moneda ISO 4217 (se normaliza a mayúsculas)',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
    pattern: '^[A-Z]{3}$',
  })
  @Transform(uppercaseString)
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO 4217 code',
  })
  currency!: string;

  @ApiProperty({
    description: 'Descripción libre del pago',
    example: 'Suscripción anual',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @Length(1, 255)
  description?: string;
}
