import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponse } from '../../../../../shared/presentation/http/responses/error.response.js';
import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case.js';
import { GetUserByIdUseCase } from '../../../application/use-cases/get-user-by-id.use-case.js';
import { ListUsersUseCase } from '../../../application/use-cases/list-users.use-case.js';
import { UserPresenter, UserResponse } from '../presenters/user.presenter.js';
import { CreateUserRequest } from '../requests/create-user.request.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly getUserById: GetUserByIdUseCase,
    private readonly listUsers: ListUsersUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ type: UserResponse })
  @ApiConflictResponse({
    description: 'Email already taken',
    type: ErrorResponse,
  })
  async create(@Body() body: CreateUserRequest): Promise<UserResponse> {
    const user = await this.createUser.execute({
      name: body?.name,
      email: body?.email,
    });
    return UserPresenter.toHttp(user);
  }

  @Get()
  @ApiOperation({ summary: 'List every user' })
  @ApiOkResponse({ type: [UserResponse] })
  async list(): Promise<UserResponse[]> {
    const users = await this.listUsers.execute();
    return users.map((user) => UserPresenter.toHttp(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id' })
  @ApiOkResponse({ type: UserResponse })
  @ApiNotFoundResponse({ description: 'Unknown user', type: ErrorResponse })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponse> {
    const user = await this.getUserById.execute(id);
    return UserPresenter.toHttp(user);
  }
}
