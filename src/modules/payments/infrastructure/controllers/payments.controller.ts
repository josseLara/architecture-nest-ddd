import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../../common/swagger/error-response.dto';
import { ApprovePaymentCommand } from '../../application/commands/approve-payment.command';
import { ApprovePaymentHandler } from '../../application/commands/approve-payment.handler';
import { CreatePaymentCommand } from '../../application/commands/create-payment.command';
import { CreatePaymentHandler } from '../../application/commands/create-payment.handler';
import { RejectPaymentCommand } from '../../application/commands/reject-payment.command';
import { RejectPaymentHandler } from '../../application/commands/reject-payment.handler';
import { CreatePaymentDto } from '../../application/dtos/create-payment.dto';
import { ListPaymentsQueryDto } from '../../application/dtos/list-payments-query.dto';
import {
  PaginatedPaymentsResponseDto,
  PaymentResponseDto,
} from '../../application/dtos/payment-response.dto';
import { RejectPaymentDto } from '../../application/dtos/reject-payment.dto';
import { GetPaymentQuery } from '../../application/queries/get-payment.query';
import { GetPaymentHandler } from '../../application/queries/get-payment.handler';
import { ListPaymentsQuery } from '../../application/queries/list-payments.query';
import { ListPaymentsHandler } from '../../application/queries/list-payments.handler';

const PAYMENT_ID_EXAMPLE = '65e23d30-b548-4955-8e8f-e24d3a650bd8';

@ApiTags('payments')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({
  type: ErrorResponseDto,
  description:
    'x-api-key ausente o inválida. Solo aplica si API_KEY está configurada.',
})
@ApiInternalServerErrorResponse({
  type: ErrorResponseDto,
  description: 'Error inesperado del servidor.',
})
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly createPayment: CreatePaymentHandler,
    private readonly approvePayment: ApprovePaymentHandler,
    private readonly rejectPayment: RejectPaymentHandler,
    private readonly getPayment: GetPaymentHandler,
    private readonly listPayments: ListPaymentsHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un pago',
    description:
      'Registra un pago en estado `pending`. La `reference` es única y se usa para evitar duplicados; un reintento con la misma referencia devuelve 409.',
  })
  @ApiCreatedResponse({
    description: 'Pago creado en estado pending.',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Payload inválido (campos faltantes, importe o moneda inválidos).',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe un pago con la misma reference.',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    const payment = await this.createPayment.execute(
      new CreatePaymentCommand(
        dto.reference,
        dto.customerId,
        dto.amount,
        dto.currency,
        dto.description,
      ),
    );

    return PaymentResponseDto.fromDomain(payment);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar pagos',
    description:
      'Devuelve pagos ordenados del más reciente al más antiguo. Todos los filtros son opcionales y se combinan con AND.',
  })
  @ApiOkResponse({
    description: 'Página de pagos y metadatos de paginación.',
    type: PaginatedPaymentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Filtro o parámetro de paginación inválido.',
    type: ErrorResponseDto,
  })
  async findAll(
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedPaymentsResponseDto> {
    const result = await this.listPayments.execute(
      new ListPaymentsQuery(
        {
          status: query.status,
          currency: query.currency,
          customerId: query.customerId,
        },
        query.page,
        query.limit,
      ),
    );

    return PaginatedPaymentsResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un pago por id',
    description: 'Devuelve el detalle completo de un pago.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 del pago',
    format: 'uuid',
    example: PAYMENT_ID_EXAMPLE,
  })
  @ApiOkResponse({
    description: 'Pago encontrado.',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no tiene formato UUID v4.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No existe un pago con ese id.',
    type: ErrorResponseDto,
  })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.getPayment.execute(new GetPaymentQuery(id));

    return PaymentResponseDto.fromDomain(payment);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar un pago',
    description:
      'Transiciona un pago de `pending` a `approved`. Un pago ya aprobado o rechazado devuelve 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 del pago',
    format: 'uuid',
    example: PAYMENT_ID_EXAMPLE,
  })
  @ApiOkResponse({
    description: 'Pago aprobado.',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El id no tiene formato UUID v4.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No existe un pago con ese id.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Transición inválida: el pago no está en estado pending.',
    type: ErrorResponseDto,
  })
  async approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.approvePayment.execute(
      new ApprovePaymentCommand(id),
    );

    return PaymentResponseDto.fromDomain(payment);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar un pago',
    description:
      'Transiciona un pago de `pending` a `rejected` y guarda el motivo. Un pago ya resuelto devuelve 409.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID v4 del pago',
    format: 'uuid',
    example: PAYMENT_ID_EXAMPLE,
  })
  @ApiOkResponse({
    description: 'Pago rechazado.',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Id inválido o motivo de rechazo inválido.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No existe un pago con ese id.',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Transición inválida: el pago no está en estado pending.',
    type: ErrorResponseDto,
  })
  async reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.rejectPayment.execute(
      new RejectPaymentCommand(id, dto.reason),
    );

    return PaymentResponseDto.fromDomain(payment);
  }
}
