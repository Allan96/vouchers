import { ApiProperty } from '@nestjs/swagger';
import type { UserOutput } from '../../../application/dtos/user.output.js';

export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name: string;

  @ApiProperty({ format: 'email', example: 'ada@example.com' })
  email: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class UserPresenter {
  static toHttp(user: UserOutput): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
