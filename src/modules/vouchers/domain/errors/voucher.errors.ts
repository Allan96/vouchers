import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../../shared/domain/errors/domain.error.js';

export class InvalidVoucherCodeError extends ValidationError {
  constructor(code: string) {
    super(`Invalid voucher code: "${code}"`);
  }
}

export class InvalidVoucherValueError extends ValidationError {
  constructor() {
    super('Voucher value must be a number greater than or equal to 0');
  }
}

export class InvalidVoucherLimitError extends ValidationError {
  constructor(field: 'limit' | 'userLimit') {
    super(`Voucher "${field}" must be an integer greater than or equal to 0`);
  }
}

export class VoucherNotFoundError extends NotFoundError {
  constructor(code: string) {
    super(`Voucher "${code}" not found`);
  }
}

export class InvalidUserIdError extends ValidationError {
  constructor(userId: string) {
    super(`Invalid user id: "${userId}"`);
  }
}

export class VoucherNotAvailableForCategoriesError extends ConflictError {
  constructor(code: string) {
    super(`Voucher "${code}" is not available for the given categories`);
  }
}

export class VoucherLimitReachedError extends ConflictError {
  constructor(code: string, limit: number) {
    super(`Voucher "${code}" reached its limit of ${limit} use(s)`);
  }
}

export class VoucherUserLimitReachedError extends ConflictError {
  constructor(code: string, userLimit: number) {
    super(
      `Voucher "${code}" was already used ${userLimit} time(s) by this user`,
    );
  }
}

export class VoucherNotAvailableError extends ConflictError {
  constructor() {
    super('O voucher não está mais disponivel');
  }
}
