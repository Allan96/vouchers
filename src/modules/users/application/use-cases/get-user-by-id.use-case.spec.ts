import { User } from '../../domain/entities/user.js';
import { UserNotFoundError } from '../../domain/errors/user.errors.js';
import { InMemoryUserRepository } from '../../infrastructure/persistence/in-memory/in-memory-user.repository.js';
import { GetUserByIdUseCase } from './get-user-by-id.use-case.js';

describe('GetUserByIdUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: GetUserByIdUseCase;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new GetUserByIdUseCase(users);
  });

  it('returns the user', async () => {
    await users.save(
      User.create({ id: 'id-1', name: 'Ada', email: 'ada@example.com' }),
    );

    await expect(useCase.execute('id-1')).resolves.toMatchObject({
      id: 'id-1',
      name: 'Ada',
    });
  });

  it('fails when the user does not exist', async () => {
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
