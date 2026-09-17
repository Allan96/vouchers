import { UserAlreadyExistsError } from '../../domain/errors/user.errors.js';
import { InMemoryUserRepository } from '../../infrastructure/persistence/in-memory/in-memory-user.repository.js';
import type { IdGenerator } from '../ports/id-generator.js';
import { CreateUserUseCase } from './create-user.use-case.js';

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    const ids: IdGenerator = { generate: () => 'fixed-id' };
    useCase = new CreateUserUseCase(users, ids);
  });

  it('creates and persists a user', async () => {
    const output = await useCase.execute({
      name: 'Ada',
      email: 'ada@example.com',
    });

    expect(output).toMatchObject({
      id: 'fixed-id',
      name: 'Ada',
      email: 'ada@example.com',
    });
    expect(await users.findById('fixed-id')).not.toBeNull();
  });

  it('fails when the email is already taken', async () => {
    await useCase.execute({ name: 'Ada', email: 'ada@example.com' });

    await expect(
      useCase.execute({ name: 'Other', email: 'ADA@example.com' }),
    ).rejects.toBeInstanceOf(UserAlreadyExistsError);
  });
});
