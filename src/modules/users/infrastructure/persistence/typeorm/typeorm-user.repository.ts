import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { User } from '../../../domain/entities/user.js';
import { UserAlreadyExistsError } from '../../../domain/errors/user.errors.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { Email } from '../../../domain/value-objects/email.js';
import { UserOrmEntity } from './user.orm-entity.js';
import { UserOrmMapper } from './user.orm-mapper.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class TypeOrmUserRepository extends UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.users.findOne({ where: { id } });
    return row ? UserOrmMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.users.findOne({ where: { email: email.value } });
    return row ? UserOrmMapper.toDomain(row) : null;
  }

  async findAll(): Promise<User[]> {
    const rows = await this.users.find({ order: { createdAt: 'ASC' } });
    return rows.map((row) => UserOrmMapper.toDomain(row));
  }

  async save(user: User): Promise<void> {
    try {
      await this.users.save(UserOrmMapper.toPersistence(user));
    } catch (error) {
      // Translates the driver error into a domain error, so a concurrent insert
      // surfaces as 409 instead of leaking a database failure.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        throw new UserAlreadyExistsError(user.email.value);
      }
      throw error;
    }
  }
}
