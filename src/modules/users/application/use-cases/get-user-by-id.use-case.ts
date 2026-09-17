import type { UseCase } from '../../../../shared/application/use-case.js';
import { UserNotFoundError } from '../../domain/errors/user.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { toUserOutput, type UserOutput } from '../dtos/user.output.js';

export class GetUserByIdUseCase implements UseCase<string, UserOutput> {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<UserOutput> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new UserNotFoundError(id);
    }
    return toUserOutput(user);
  }
}
