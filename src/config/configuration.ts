import { registerAs } from '@nestjs/config';

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfiguration {
  nodeEnv: NodeEnv;
  port: number;
  apiPrefix: string;
  apiKey?: string;
  corsOrigins: string[];
  paymentsDataFile: string;
}

const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];
const DEFAULT_PORT = 3000;
const DEFAULT_API_PREFIX = 'api';
const DEFAULT_DATA_FILE = 'data/payments.json';

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (!value) {
    return 'development';
  }

  if (!NODE_ENVS.includes(value as NodeEnv)) {
    throw new Error(
      `NODE_ENV must be one of: ${NODE_ENVS.join(', ')} (received "${value}")`,
    );
  }

  return value as NodeEnv;
}

function parsePort(value: string | undefined): number {
  if (!value || value.trim() === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT must be an integer between 1 and 65535 (received "${value}")`,
    );
  }

  return port;
}

function parseApiPrefix(value: string | undefined): string {
  const normalized = (value ?? DEFAULT_API_PREFIX)
    .trim()
    .replace(/^\/+|\/+$/g, '');

  if (normalized === '') {
    return DEFAULT_API_PREFIX;
  }

  if (!/^[A-Za-z0-9/_-]+$/.test(normalized)) {
    throw new Error(
      `API_PREFIX contains unsupported characters (received "${value}")`,
    );
  }

  return normalized;
}

function parseOrigins(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  ];
}

function parseApiKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

/**
 * Typed configuration factory exposed under the "app" namespace.
 * `ConfigService.getOrThrow<AppConfiguration>('app')` is the single source of
 * truth for every runtime setting.
 */
export default registerAs('app', (): AppConfiguration => ({
  nodeEnv: parseNodeEnv(process.env.NODE_ENV),
  port: parsePort(process.env.PORT),
  apiPrefix: parseApiPrefix(process.env.API_PREFIX),
  apiKey: parseApiKey(process.env.API_KEY),
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  paymentsDataFile: process.env.PAYMENTS_DATA_FILE?.trim() || DEFAULT_DATA_FILE,
}));
