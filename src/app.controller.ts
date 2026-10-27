import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok';
  service: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description:
      'Endpoint público para verificar que el proceso está vivo. No requiere API key.',
  })
  @ApiOkResponse({
    description: 'Servicio operativo.',
    schema: {
      example: {
        status: 'ok',
        service: 'payments-api',
        environment: 'development',
        uptime: 42,
        timestamp: '2026-10-26T20:45:12.923Z',
      },
    },
  })
  health(): HealthResponse {
    return {
      status: 'ok',
      service: 'payments-api',
      environment:
        this.configService.get<string>('app.nodeEnv') ?? 'development',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
