import { Voucher } from '../../domain/entities/voucher.js';
import {
  InvalidUserIdError,
  VoucherLimitReachedError,
  VoucherNotAvailableError,
  VoucherNotAvailableForCategoriesError,
  VoucherNotFoundError,
  VoucherUserLimitReachedError,
} from '../../domain/errors/voucher.errors.js';
import { UserId } from '../../domain/value-objects/user-id.js';
import { InMemoryVoucherReservationRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher-reservation.repository.js';
import { InMemoryVoucherUsageRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher-usage.repository.js';
import { InMemoryVoucherRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher.repository.js';
import { VoucherEligibility } from '../services/voucher-eligibility.js';
import { ValidateVoucherUseCase } from './validate-voucher.use-case.js';
import { UseVoucherUseCase } from './use-voucher.use-case.js';

const VOUCHER_UUID = 'ff4b6e1c-6a4a-4f9e-9b6c-0f1d2e3a4b5c';
const USER_ID = '3f1c5e0a-2b3d-4c5e-8f90-123456789abc';
const OTHER_USER = 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc';

describe('UseVoucherUseCase', () => {
  let vouchers: InMemoryVoucherRepository;
  let usages: InMemoryVoucherUsageRepository;
  let reservations: InMemoryVoucherReservationRepository;
  let useCase: UseVoucherUseCase;
  let validate: ValidateVoucherUseCase;
  let currentTime: Date;

  const clock = { now: () => currentTime };
  const input = {
    userId: USER_ID,
    categories: ['electronics'],
    code: 'welcome10',
  };

  const givenVoucher = (
    userLimit: number | null = null,
    validateDate: Date | null = null,
    limit = 5,
  ) =>
    vouchers.add(
      Voucher.create({
        uuid: VOUCHER_UUID,
        code: 'WELCOME10',
        value: 10,
        limit,
        userLimit,
        validateDate,
        restriction: { categories: ['electronics'] },
      }),
    );

  const usageCount = (userId = USER_ID) =>
    usages.countByUserAndVoucher(UserId.create(userId), VOUCHER_UUID);

  const activeHold = (userId = USER_ID) =>
    reservations.findActiveByUserAndCode(
      UserId.create(userId),
      'WELCOME10',
      currentTime,
    );

  beforeEach(() => {
    currentTime = new Date('2026-09-17T12:00:00.000Z');
    vouchers = new InMemoryVoucherRepository();
    usages = new InMemoryVoucherUsageRepository();
    reservations = new InMemoryVoucherReservationRepository();
    const eligibility = new VoucherEligibility(vouchers, usages, reservations);
    useCase = new UseVoucherUseCase(eligibility, usages, reservations, clock);
    validate = new ValidateVoucherUseCase(eligibility, reservations, clock);
  });

  it('records the usage and returns the voucher', async () => {
    givenVoucher();

    await expect(useCase.execute(input)).resolves.toMatchObject({
      uuid: VOUCHER_UUID,
      code: 'WELCOME10',
    });
    await expect(usageCount()).resolves.toBe(1);
  });

  it('moves the hold out of the reservation store', async () => {
    givenVoucher();
    await validate.execute(input);
    await expect(activeHold()).resolves.not.toBeNull();

    await useCase.execute(input);

    await expect(activeHold()).resolves.toBeNull();
    await expect(usageCount()).resolves.toBe(1);
  });

  it('works without a previous validation', async () => {
    givenVoucher();

    await useCase.execute(input);

    await expect(usageCount()).resolves.toBe(1);
    await expect(activeHold()).resolves.toBeNull();
  });

  it('keeps other users holds untouched', async () => {
    givenVoucher(null, null, 5);
    await validate.execute({ ...input, userId: OTHER_USER });

    await useCase.execute(input);

    await expect(activeHold(OTHER_USER)).resolves.not.toBeNull();
  });

  it('counts the new usage against the total limit', async () => {
    givenVoucher(null, null, 1);
    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherLimitReachedError,
    );
    await expect(usageCount()).resolves.toBe(1);
  });

  it('counts the new usage against the per-user limit', async () => {
    givenVoucher(1, null, 10);
    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherUserLimitReachedError,
    );
  });

  it('lets another user use it after the first one', async () => {
    givenVoucher(1, null, 10);
    await useCase.execute(input);

    await expect(
      useCase.execute({ ...input, userId: OTHER_USER }),
    ).resolves.toMatchObject({ code: 'WELCOME10' });
  });

  it('applies the same rules as the validation', async () => {
    givenVoucher(null, new Date(currentTime.getTime() - 1));

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherNotAvailableError,
    );
    await expect(usageCount()).resolves.toBe(0);
  });

  it('refuses categories outside the restriction', async () => {
    givenVoucher();

    await expect(
      useCase.execute({ ...input, categories: ['toys'] }),
    ).rejects.toBeInstanceOf(VoucherNotAvailableForCategoriesError);
    await expect(usageCount()).resolves.toBe(0);
  });

  it('fails for an unknown code', async () => {
    givenVoucher();

    await expect(
      useCase.execute({ ...input, code: 'UNKNOWN' }),
    ).rejects.toBeInstanceOf(VoucherNotFoundError);
  });

  it('fails for a malformed user id', async () => {
    givenVoucher();

    await expect(
      useCase.execute({ ...input, userId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(InvalidUserIdError);
  });
});
