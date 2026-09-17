import { InvalidUserNameError } from '../errors/user.errors.js';
import { Email } from '../value-objects/email.js';

export interface CreateUserProps {
  id: string;
  name: string;
  email: string;
}

export interface RestoreUserProps extends CreateUserProps {
  createdAt: Date;
}

export class User {
  private constructor(
    readonly id: string,
    private _name: string,
    readonly email: Email,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateUserProps, now: Date = new Date()): User {
    return new User(
      props.id,
      User.validateName(props.name),
      Email.create(props.email),
      now,
    );
  }

  static restore(props: RestoreUserProps): User {
    return new User(
      props.id,
      props.name,
      Email.create(props.email),
      props.createdAt,
    );
  }

  get name(): string {
    return this._name;
  }

  rename(name: string): void {
    this._name = User.validateName(name);
  }

  private static validateName(name: string): string {
    const trimmed = name?.trim() ?? '';
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new InvalidUserNameError();
    }
    return trimmed;
  }
}
