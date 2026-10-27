import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trimString } from './string-transformers';

export class RejectPaymentDto {
  @ApiProperty({
    description: 'Motivo del rechazo (se eliminan espacios externos)',
    example: 'Sospecha de fraude',
    minLength: 3,
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString()
  @Length(3, 255)
  reason!: string;
}
