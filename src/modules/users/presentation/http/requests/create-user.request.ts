import { ApiProperty } from '@nestjs/swagger';

export class CreateUserRequest {
  @ApiProperty({ example: 'Ada Lovelace', minLength: 2, maxLength: 100 })
  name: string;

  @ApiProperty({ format: 'email', example: 'ada@example.com' })
  email: string;
}
