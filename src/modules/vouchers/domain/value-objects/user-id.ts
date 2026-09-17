import { InvalidUserIdError } from '../errors/voucher.errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Reference to a user owned by another module, so only the id crosses over. */
export class UserId {
  private constructor(readonly value: string) {}

  static create(raw: string): UserId {
    const normalized = raw?.trim().toLowerCase() ?? '';
    if (!UUID_PATTERN.test(normalized)) {
      throw new InvalidUserIdError(raw);
    }
    return new UserId(normalized);
  }
}
