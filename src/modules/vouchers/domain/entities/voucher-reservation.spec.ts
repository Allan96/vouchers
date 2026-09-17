import { UserId } from '../value-objects/user-id.js';
import {
  RESERVATION_TTL_MINUTES,
  VoucherReservation,
} from './voucher-reservation.js';

const userId = UserId.create('3f1c5e0a-2b3d-4c5e-8f90-123456789abc');
const now = new Date('2026-09-17T12:00:00.000Z');
const minutesFrom = (minutes: number) =>
  new Date(now.getTime() + minutes * 60_000);

describe('VoucherReservation', () => {
  it(`expires ${RESERVATION_TTL_MINUTES} minutes after it is created`, () => {
    const reservation = VoucherReservation.create(userId, 'WELCOME10', now);

    expect(reservation.expireDate).toEqual(
      minutesFrom(RESERVATION_TTL_MINUTES),
    );
  });

  it('stays active inside the window', () => {
    const reservation = VoucherReservation.create(userId, 'WELCOME10', now);

    expect(reservation.isActive(now)).toBe(true);
    expect(reservation.isActive(minutesFrom(14))).toBe(true);
  });

  it('is no longer active once expireDate is reached', () => {
    const reservation = VoucherReservation.create(userId, 'WELCOME10', now);

    expect(reservation.isActive(minutesFrom(RESERVATION_TTL_MINUTES))).toBe(
      false,
    );
    expect(reservation.isActive(minutesFrom(16))).toBe(false);
  });
});
