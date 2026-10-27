import type { TransformFnParams } from 'class-transformer';

/**
 * class-transformer passes `value` as `any`; these helpers narrow it to
 * `unknown` so the DTOs stay lint-clean and type-safe.
 */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export function uppercaseString({ value }: TransformFnParams): unknown {
  return typeof value === 'string'
    ? value.trim().toUpperCase()
    : (value as unknown);
}
