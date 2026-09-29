import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppointmentVerificationPin1787944489444 implements MigrationInterface {
    name = 'AddAppointmentVerificationPin1787944489444';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "verificationPin" varchar(10)`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "isPinVerified" boolean DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "isPinVerified"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "verificationPin"`);
    }
}
