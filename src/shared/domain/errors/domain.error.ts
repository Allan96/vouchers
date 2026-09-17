export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class ValidationError extends DomainError {}

export abstract class NotFoundError extends DomainError {}

export abstract class ConflictError extends DomainError {}
