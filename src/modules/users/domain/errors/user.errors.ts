import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error.js';

export class InvalidEmailError extends ValidationError {
  constructor(email: string) {
    super(`Invalid email: "${email}"`);
  }
}

export class InvalidUserNameError extends ValidationError {
  constructor() {
    super('User name must have between 2 and 100 characters');
  }
}

export class UserAlreadyExistsError extends ConflictError {
  constructor(email: string) {
    super(`User with email "${email}" already exists`);
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`User "${id}" not found`);
  }
}
