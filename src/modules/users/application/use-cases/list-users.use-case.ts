import type { UseCase } from '../../../../shared/application/use-case.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { toUserOutput, type UserOutput } from '../dtos/user.output.js';

export class ListUsersUseCase implements UseCase<void, UserOutput[]> {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<UserOutput[]> {
    const users = await this.users.findAll();
    return users.map(toUserOutput);
  }
}
