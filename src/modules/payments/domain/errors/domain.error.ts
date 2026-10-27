/**
 * Base class for every business rule violation.
 *
 * It is intentionally framework-agnostic: the HTTP representation (status
 * code, response body) is decided by the infrastructure layer.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}
