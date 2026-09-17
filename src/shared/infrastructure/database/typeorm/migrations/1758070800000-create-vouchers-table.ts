import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVouchersTable1758070800000 implements MigrationInterface {
  name = 'CreateVouchersTable1758070800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "vouchers" (
        "uuid" uuid NOT NULL,
        "code" character varying(50) NOT NULL,
        "value" numeric(12,2) NOT NULL,
        "validate_date" TIMESTAMP WITH TIME ZONE,
        "limit" integer NOT NULL,
        "user_limit" integer,
        "restriction" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_vouchers" PRIMARY KEY ("uuid")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_vouchers_code" ON "vouchers" ("code")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_vouchers_code"`);
    await queryRunner.query(`DROP TABLE "vouchers"`);
  }
}
