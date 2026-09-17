import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersVouchersTable1758074400000 implements MigrationInterface {
  name = 'CreateUsersVouchersTable1758074400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users_vouchers" (
        "uuid" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "voucher_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_vouchers" PRIMARY KEY ("uuid"),
        CONSTRAINT "FK_users_vouchers_voucher" FOREIGN KEY ("voucher_id")
          REFERENCES "vouchers"("uuid") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_vouchers_user_voucher"
        ON "users_vouchers" ("user_id", "voucher_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_vouchers_user_voucher"`);
    await queryRunner.query(`DROP TABLE "users_vouchers"`);
  }
}
