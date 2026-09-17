import { User } from '../../../domain/entities/user.js';
import { UserOrmEntity } from './user.orm-entity.js';

export class UserOrmMapper {
  static toDomain(row: UserOrmEntity): User {
    return User.restore({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.createdAt,
    });
  }

  static toPersistence(user: User): UserOrmEntity {
    const row = new UserOrmEntity();
    row.id = user.id;
    row.name = user.name;
    row.email = user.email.value;
    row.createdAt = user.createdAt;
    return row;
  }
}
