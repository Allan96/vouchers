import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1758067200000 implements MigrationInterface {
  name = 'CreateUsersTable1758067200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "email" character varying(320) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
