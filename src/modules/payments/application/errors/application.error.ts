/**
 * Base class for errors raised by the application layer (orchestration,
 * lookups, etc.). Kept separate from DomainError so the HTTP adapter can
 * translate both without leaking framework details into the domain.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}
