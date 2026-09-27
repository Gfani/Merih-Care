import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppointmentCoordinates1787944489443 implements MigrationInterface {
    name = 'AddAppointmentCoordinates1787944489443';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "latitude" float`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "longitude" float`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "longitude"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "latitude"`);
    }
}
