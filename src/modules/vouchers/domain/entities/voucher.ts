import {
  InvalidVoucherCodeError,
  InvalidVoucherLimitError,
  InvalidVoucherValueError,
} from '../errors/voucher.errors.js';

/** Free-form rules stored as JSONB (minimum cart value, categories, ...). */
export type VoucherRestriction = Record<string, unknown>;

export interface CreateVoucherProps {
  uuid: string;
  code: string;
  value: number;
  validateDate?: Date | null;
  limit: number;
  userLimit?: number | null;
  restriction?: VoucherRestriction;
}

export interface RestoreVoucherProps extends CreateVoucherProps {
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,49}$/;

const normalizeCategory = (category: string): string =>
  typeof category === 'string' ? category.trim().toLowerCase() : '';

export class Voucher {
  private constructor(
    readonly uuid: string,
    readonly code: string,
    readonly value: number,
    readonly validateDate: Date | null,
    readonly limit: number,
    readonly userLimit: number | null,
    readonly restriction: VoucherRestriction,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly deletedAt: Date | null,
  ) {}

  static create(props: CreateVoucherProps, now: Date = new Date()): Voucher {
    return new Voucher(
      props.uuid,
      Voucher.normalizeCode(props.code),
      Voucher.validateValue(props.value),
      props.validateDate ?? null,
      Voucher.validateLimit(props.limit, 'limit'),
      props.userLimit === null || props.userLimit === undefined
        ? null
        : Voucher.validateLimit(props.userLimit, 'userLimit'),
      props.restriction ?? {},
      now,
      now,
      null,
    );
  }

  static restore(props: RestoreVoucherProps): Voucher {
    return new Voucher(
      props.uuid,
      props.code,
      props.value,
      props.validateDate ?? null,
      props.limit,
      props.userLimit ?? null,
      props.restriction ?? {},
      props.createdAt,
      props.updatedAt,
      props.deletedAt ?? null,
    );
  }

  /**
   * The categories the voucher is restricted to, or `null` when
   * `restriction.categories` is absent/empty. The JSONB is free-form, so
   * anything that is not a non-empty list of strings means "no restriction".
   */
  private get restrictedCategories(): string[] | null {
    const raw = this.restriction.categories;
    if (!Array.isArray(raw)) {
      return null;
    }

    const categories = raw
      .filter((category): category is string => typeof category === 'string')
      .map(normalizeCategory)
      .filter((category) => category !== '');

    return categories.length > 0 ? categories : null;
  }

  /**
   * Without `restriction.categories` the voucher applies to anything. Otherwise
   * at least one of the given categories has to be in the allowed list.
   */
  isAvailableForCategories(categories: string[]): boolean {
    const allowed = this.restrictedCategories;
    if (allowed === null) {
      return true;
    }

    return (categories ?? []).some((category) =>
      allowed.includes(normalizeCategory(category)),
    );
  }

  /**
   * A voucher without `validateDate` never expires. Otherwise it stays valid up
   * to and including that instant.
   */
  isExpired(now: Date = new Date()): boolean {
    return (
      this.validateDate !== null && now.getTime() > this.validateDate.getTime()
    );
  }

  /**
   * Codes are stored normalized, so any lookup must go through here to stay
   * case/whitespace insensitive.
   */
  static normalizeCode(code: string): string {
    const normalized = code?.trim().toUpperCase() ?? '';
    if (!CODE_PATTERN.test(normalized)) {
      throw new InvalidVoucherCodeError(code);
    }
    return normalized;
  }

  private static validateValue(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidVoucherValueError();
    }
    return value;
  }

  private static validateLimit(
    limit: number,
    field: 'limit' | 'userLimit',
  ): number {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new InvalidVoucherLimitError(field);
    }
    return limit;
  }
}
