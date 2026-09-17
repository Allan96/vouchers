import type { User } from '../../domain/entities/user.js';

export interface UserOutput {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export const toUserOutput = (user: User): UserOutput => ({
  id: user.id,
  name: user.name,
  email: user.email.value,
  createdAt: user.createdAt,
});
