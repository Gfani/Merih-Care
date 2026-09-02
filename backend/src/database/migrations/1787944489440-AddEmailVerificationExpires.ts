import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailVerificationExpires1787944489440 implements MigrationInterface {
  name = "AddEmailVerificationExpires1787944489440";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationExpires" varchar`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationExpires"`
    );
  }
}
