import {
  InvalidEmailError,
  InvalidUserNameError,
} from '../errors/user.errors.js';
import { User } from './user.js';

describe('User', () => {
  it('creates a user with normalized email and trimmed name', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const user = User.create(
      { id: 'id-1', name: '  Ada Lovelace ', email: ' ADA@Example.com ' },
      now,
    );

    expect(user.name).toBe('Ada Lovelace');
    expect(user.email.value).toBe('ada@example.com');
    expect(user.createdAt).toBe(now);
  });

  it('rejects an invalid email', () => {
    expect(() =>
      User.create({ id: 'id-1', name: 'Ada', email: 'not-an-email' }),
    ).toThrow(InvalidEmailError);
  });

  it('rejects a name that is too short', () => {
    expect(() =>
      User.create({ id: 'id-1', name: 'A', email: 'ada@example.com' }),
    ).toThrow(InvalidUserNameError);
  });
});
