import { Injectable } from '@nestjs/common';
import { User } from '../../../domain/entities/user.js';
import { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { Email } from '../../../domain/value-objects/email.js';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

@Injectable()
export class InMemoryUserRepository extends UserRepository {
  private readonly records = new Map<string, UserRecord>();

  async findById(id: string): Promise<User | null> {
    const record = this.records.get(id);
    return record ? User.restore(record) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const record of this.records.values()) {
      if (record.email === email.value) return User.restore(record);
    }
    return null;
  }

  async findAll(): Promise<User[]> {
    return [...this.records.values()].map((record) => User.restore(record));
  }

  async save(user: User): Promise<void> {
    this.records.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email.value,
      createdAt: user.createdAt,
    });
  }
}
