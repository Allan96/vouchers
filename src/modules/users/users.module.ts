import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdGenerator } from './application/ports/id-generator.js';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case.js';
import { GetUserByIdUseCase } from './application/use-cases/get-user-by-id.use-case.js';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case.js';
import { UserRepository } from './domain/repositories/user.repository.js';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm/typeorm-user.repository.js';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/user.orm-entity.js';
import { CryptoIdGenerator } from './infrastructure/services/crypto-id-generator.js';
import { UsersController } from './presentation/http/controllers/users.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  controllers: [UsersController],
  providers: [
    // Adapters (infrastructure) bound to ports (domain/application)
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: IdGenerator, useClass: CryptoIdGenerator },

    // Use cases are framework-agnostic, so they are wired here
    {
      provide: CreateUserUseCase,
      useFactory: (users: UserRepository, ids: IdGenerator) =>
        new CreateUserUseCase(users, ids),
      inject: [UserRepository, IdGenerator],
    },
    {
      provide: GetUserByIdUseCase,
      useFactory: (users: UserRepository) => new GetUserByIdUseCase(users),
      inject: [UserRepository],
    },
    {
      provide: ListUsersUseCase,
      useFactory: (users: UserRepository) => new ListUsersUseCase(users),
      inject: [UserRepository],
    },
  ],
})
export class UsersModule {}
