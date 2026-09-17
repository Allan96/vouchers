import type { UseCase } from '../../../../shared/application/use-case.js';
import { User } from '../../domain/entities/user.js';
import { UserAlreadyExistsError } from '../../domain/errors/user.errors.js';
import type { UserRepository } from '../../domain/repositories/user.repository.js';
import { Email } from '../../domain/value-objects/email.js';
import type { CreateUserInput } from '../dtos/create-user.input.js';
import { toUserOutput, type UserOutput } from '../dtos/user.output.js';
import type { IdGenerator } from '../ports/id-generator.js';

export class CreateUserUseCase implements UseCase<CreateUserInput, UserOutput> {
  constructor(
    private readonly users: UserRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateUserInput): Promise<UserOutput> {
    const email = Email.create(input.email);

    if (await this.users.findByEmail(email)) {
      throw new UserAlreadyExistsError(email.value);
    }

    const user = User.create({
      id: this.ids.generate(),
      name: input.name,
      email: email.value,
    });
    await this.users.save(user);

    return toUserOutput(user);
  }
}
