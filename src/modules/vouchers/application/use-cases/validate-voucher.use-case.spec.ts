import { RESERVATION_TTL_MINUTES } from '../../domain/entities/voucher-reservation.js';
import { Voucher } from '../../domain/entities/voucher.js';
import {
  InvalidUserIdError,
  VoucherLimitReachedError,
  VoucherNotAvailableForCategoriesError,
  InvalidVoucherCodeError,
  VoucherNotAvailableError,
  VoucherNotFoundError,
  VoucherUserLimitReachedError,
} from '../../domain/errors/voucher.errors.js';
import { InMemoryVoucherReservationRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher-reservation.repository.js';
import { InMemoryVoucherUsageRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher-usage.repository.js';
import { InMemoryVoucherRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher.repository.js';
import { UserId } from '../../domain/value-objects/user-id.js';
import { VoucherEligibility } from '../services/voucher-eligibility.js';
import { ValidateVoucherUseCase } from './validate-voucher.use-case.js';

const VOUCHER_UUID = 'ff4b6e1c-6a4a-4f9e-9b6c-0f1d2e3a4b5c';
const USER_ID = '3f1c5e0a-2b3d-4c5e-8f90-123456789abc';

describe('ValidateVoucherUseCase', () => {
  let vouchers: InMemoryVoucherRepository;
  let usages: InMemoryVoucherUsageRepository;
  let reservations: InMemoryVoucherReservationRepository;
  let useCase: ValidateVoucherUseCase;
  let currentTime: Date;

  const clock = { now: () => currentTime };
  const advanceMinutes = (minutes: number) => {
    currentTime = new Date(currentTime.getTime() + minutes * 60_000);
  };

  const input = {
    userId: USER_ID,
    categories: ['electronics'],
    code: 'welcome10',
  };

  const givenVoucher = (
    userLimit: number | null,
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

  const hoursFromNow = (hours: number) =>
    new Date(currentTime.getTime() + hours * 60 * 60 * 1000);

  const givenUsages = (count: number, userId = USER_ID) => {
    for (let i = 0; i < count; i += 1) {
      usages.add({ userId, voucherUuid: VOUCHER_UUID });
    }
  };

  beforeEach(() => {
    currentTime = new Date('2026-09-17T12:00:00.000Z');
    vouchers = new InMemoryVoucherRepository();
    usages = new InMemoryVoucherUsageRepository();
    reservations = new InMemoryVoucherReservationRepository();
    useCase = new ValidateVoucherUseCase(
      new VoucherEligibility(vouchers, usages, reservations),
      reservations,
      clock,
    );
  });

  it('returns the voucher when the user never used it', async () => {
    givenVoucher(1);

    await expect(useCase.execute(input)).resolves.toMatchObject({
      code: 'WELCOME10',
      value: 10,
    });
  });

  it('returns the voucher while the user is below the limit', async () => {
    givenVoucher(2);
    givenUsages(1);

    await expect(useCase.execute(input)).resolves.toMatchObject({
      code: 'WELCOME10',
    });
  });

  it('fails when the user reached the limit', async () => {
    givenVoucher(1);
    givenUsages(1);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherUserLimitReachedError,
    );
  });

  it('ignores usages from other users', async () => {
    givenVoucher(1);
    givenUsages(3, 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc');

    await expect(useCase.execute(input)).resolves.toMatchObject({
      code: 'WELCOME10',
    });
  });

  it('has no per-user limit when userLimit is null', async () => {
    givenVoucher(null, null, 50);
    givenUsages(10);

    await expect(useCase.execute(input)).resolves.toMatchObject({
      code: 'WELCOME10',
    });
  });

  it('returns the voucher while the total limit is not reached', async () => {
    givenVoucher(null, null, 3);
    givenUsages(2, 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc');

    await expect(useCase.execute(input)).resolves.toMatchObject({
      code: 'WELCOME10',
    });
  });

  it('fails when the total limit was reached across all users', async () => {
    givenVoucher(null, null, 2);
    givenUsages(1, 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc');
    givenUsages(1, 'bb1c5e0a-2b3d-4c5e-8f90-123456789abc');

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherLimitReachedError,
    );
  });

  it('fails when the voucher has a zero limit', async () => {
    givenVoucher(null, null, 0);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherLimitReachedError,
    );
  });

  it('checks the total limit before the per-user limit', async () => {
    givenVoucher(1, null, 1);
    givenUsages(1, 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc');

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherLimitReachedError,
    );
  });

  it('returns the voucher while validateDate is in the future', async () => {
    givenVoucher(1, hoursFromNow(1));

    await expect(useCase.execute(input)).resolves.toMatchObject({
      code: 'WELCOME10',
    });
  });

  it('fails with the expected message when validateDate has passed', async () => {
    givenVoucher(1, hoursFromNow(-1));

    await expect(useCase.execute(input)).rejects.toThrow(
      'O voucher não está mais disponivel',
    );
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherNotAvailableError,
    );
  });

  it('checks the expiry before the per-user limit', async () => {
    givenVoucher(1, hoursFromNow(-1));
    givenUsages(1);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      VoucherNotAvailableError,
    );
  });

  it('returns the voucher when a category matches the restriction', async () => {
    givenVoucher(1);

    await expect(
      useCase.execute({ ...input, categories: ['toys', 'electronics'] }),
    ).resolves.toMatchObject({ code: 'WELCOME10' });
  });

  it('fails when no category matches the restriction', async () => {
    givenVoucher(1);

    await expect(
      useCase.execute({ ...input, categories: ['toys'] }),
    ).rejects.toBeInstanceOf(VoucherNotAvailableForCategoriesError);
  });

  it('checks the categories before the usage limits', async () => {
    givenVoucher(1, null, 1);
    givenUsages(1, 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc');

    await expect(
      useCase.execute({ ...input, categories: ['toys'] }),
    ).rejects.toBeInstanceOf(VoucherNotAvailableForCategoriesError);
  });

  describe('reservation', () => {
    const OTHER_USER = 'aa1c5e0a-2b3d-4c5e-8f90-123456789abc';

    it('holds the voucher for the user after a successful validation', async () => {
      givenVoucher(null);

      await useCase.execute(input);

      const reservation = await reservations.findActiveByUserAndCode(
        UserId.create(USER_ID),
        'WELCOME10',
        currentTime,
      );
      expect(reservation?.expireDate).toEqual(
        new Date(currentTime.getTime() + RESERVATION_TTL_MINUTES * 60_000),
      );
    });

    it('does not hold the voucher when the validation fails', async () => {
      givenVoucher(null, hoursFromNow(-1));

      await expect(useCase.execute(input)).rejects.toThrow();

      await expect(
        reservations.findActiveByUserAndCode(
          UserId.create(USER_ID),
          'WELCOME10',
          currentTime,
        ),
      ).resolves.toBeNull();
    });

    it('keeps the original expireDate while the hold is active', async () => {
      givenVoucher(null);
      await useCase.execute(input);
      const first = await reservations.findActiveByUserAndCode(
        UserId.create(USER_ID),
        'WELCOME10',
        currentTime,
      );

      advanceMinutes(10);
      await useCase.execute(input);

      const second = await reservations.findActiveByUserAndCode(
        UserId.create(USER_ID),
        'WELCOME10',
        currentTime,
      );
      expect(second?.expireDate).toEqual(first?.expireDate);
    });

    it('starts a new window once the previous one expired', async () => {
      givenVoucher(null);
      await useCase.execute(input);
      const first = await reservations.findActiveByUserAndCode(
        UserId.create(USER_ID),
        'WELCOME10',
        currentTime,
      );

      advanceMinutes(RESERVATION_TTL_MINUTES + 1);
      await useCase.execute(input);

      const second = await reservations.findActiveByUserAndCode(
        UserId.create(USER_ID),
        'WELCOME10',
        currentTime,
      );
      expect(second!.expireDate.getTime()).toBeGreaterThan(
        first!.expireDate.getTime(),
      );
      expect(second!.expireDate).toEqual(
        new Date(currentTime.getTime() + RESERVATION_TTL_MINUTES * 60_000),
      );
    });

    it("counts another user's hold as temporarily used", async () => {
      givenVoucher(null, null, 1);
      await useCase.execute({ ...input, userId: OTHER_USER });

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(
        VoucherLimitReachedError,
      );
    });

    it('frees the voucher again once that hold expires', async () => {
      givenVoucher(null, null, 1);
      await useCase.execute({ ...input, userId: OTHER_USER });

      advanceMinutes(RESERVATION_TTL_MINUTES + 1);

      await expect(useCase.execute(input)).resolves.toMatchObject({
        code: 'WELCOME10',
      });
    });

    it('does not count the requesting user own hold', async () => {
      givenVoucher(null, null, 1);
      await useCase.execute(input);

      await expect(useCase.execute(input)).resolves.toMatchObject({
        code: 'WELCOME10',
      });
    });

    it('adds up to the persisted usages against the total limit', async () => {
      givenVoucher(null, null, 2);
      givenUsages(1, 'bb1c5e0a-2b3d-4c5e-8f90-123456789abc');
      await useCase.execute({ ...input, userId: OTHER_USER });

      await expect(useCase.execute(input)).rejects.toBeInstanceOf(
        VoucherLimitReachedError,
      );
    });
  });

  it('fails when the code does not exist', async () => {
    givenVoucher(1);

    await expect(
      useCase.execute({ ...input, code: 'UNKNOWN' }),
    ).rejects.toBeInstanceOf(VoucherNotFoundError);
  });

  it('fails when the code is malformed', async () => {
    await expect(
      useCase.execute({ ...input, code: 'a b' }),
    ).rejects.toBeInstanceOf(InvalidVoucherCodeError);
  });

  it('fails when the user id is not a uuid', async () => {
    givenVoucher(1);

    await expect(
      useCase.execute({ ...input, userId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(InvalidUserIdError);
  });
});
