import {
  InvalidVoucherCodeError,
  InvalidVoucherLimitError,
  InvalidVoucherValueError,
} from '../errors/voucher.errors.js';
import { Voucher } from './voucher.js';

const props = {
  uuid: 'ff4b6e1c-6a4a-4f9e-9b6c-0f1d2e3a4b5c',
  code: 'black-friday',
  value: 50,
  limit: 100,
};

describe('Voucher', () => {
  it('normalizes the code and applies the optional defaults', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const voucher = Voucher.create(props, now);

    expect(voucher.code).toBe('BLACK-FRIDAY');
    expect(voucher.validateDate).toBeNull();
    expect(voucher.userLimit).toBeNull();
    expect(voucher.restriction).toEqual({});
    expect(voucher.createdAt).toBe(now);
    expect(voucher.updatedAt).toBe(now);
    expect(voucher.deletedAt).toBeNull();
  });

  it('keeps the optional fields when they are provided', () => {
    const validateDate = new Date('2026-10-17T00:00:00.000Z');
    const voucher = Voucher.create({
      ...props,
      validateDate,
      userLimit: 1,
      restriction: { minCartValue: 200, categories: ['books'] },
    });

    expect(voucher.validateDate).toBe(validateDate);
    expect(voucher.userLimit).toBe(1);
    expect(voucher.restriction).toEqual({
      minCartValue: 200,
      categories: ['books'],
    });
  });

  describe('isAvailableForCategories', () => {
    const withRestriction = (restriction: Record<string, unknown>) =>
      Voucher.create({ ...props, restriction });

    it('applies to anything without restriction.categories', () => {
      expect(withRestriction({}).isAvailableForCategories([])).toBe(true);
      expect(
        withRestriction({ minCartValue: 200 }).isAvailableForCategories([
          'books',
        ]),
      ).toBe(true);
    });

    it('ignores a restriction.categories that is empty or not a list', () => {
      expect(
        withRestriction({ categories: [] }).isAvailableForCategories(['books']),
      ).toBe(true);
      expect(
        withRestriction({ categories: 'books' }).isAvailableForCategories([
          'toys',
        ]),
      ).toBe(true);
    });

    it('accepts when at least one category matches', () => {
      const voucher = withRestriction({ categories: ['books', 'music'] });

      expect(voucher.isAvailableForCategories(['toys', 'music'])).toBe(true);
    });

    it('compares ignoring case and surrounding spaces', () => {
      const voucher = withRestriction({ categories: [' Books '] });

      expect(voucher.isAvailableForCategories(['BOOKS'])).toBe(true);
    });

    it('refuses when no category matches', () => {
      const voucher = withRestriction({ categories: ['books'] });

      expect(voucher.isAvailableForCategories(['toys'])).toBe(false);
    });

    it('refuses an empty list when the voucher is restricted', () => {
      const voucher = withRestriction({ categories: ['books'] });

      expect(voucher.isAvailableForCategories([])).toBe(false);
    });
  });

  describe('isExpired', () => {
    const now = new Date('2026-10-17T00:00:00.000Z');

    it('never expires without validateDate', () => {
      expect(Voucher.create(props).isExpired(now)).toBe(false);
    });

    it('is not expired before validateDate', () => {
      const voucher = Voucher.create({
        ...props,
        validateDate: new Date('2026-10-18T00:00:00.000Z'),
      });

      expect(voucher.isExpired(now)).toBe(false);
    });

    it('is still valid exactly at validateDate', () => {
      const voucher = Voucher.create({ ...props, validateDate: now });

      expect(voucher.isExpired(now)).toBe(false);
    });

    it('is expired one millisecond after validateDate', () => {
      const voucher = Voucher.create({ ...props, validateDate: now });

      expect(voucher.isExpired(new Date(now.getTime() + 1))).toBe(true);
    });
  });

  it('rejects an invalid code', () => {
    expect(() => Voucher.create({ ...props, code: 'a b' })).toThrow(
      InvalidVoucherCodeError,
    );
  });

  it('rejects a negative value', () => {
    expect(() => Voucher.create({ ...props, value: -1 })).toThrow(
      InvalidVoucherValueError,
    );
  });

  it('rejects a non-integer limit', () => {
    expect(() => Voucher.create({ ...props, limit: 1.5 })).toThrow(
      InvalidVoucherLimitError,
    );
  });

  it('rejects a negative user limit', () => {
    expect(() => Voucher.create({ ...props, userLimit: -2 })).toThrow(
      InvalidVoucherLimitError,
    );
  });
});
