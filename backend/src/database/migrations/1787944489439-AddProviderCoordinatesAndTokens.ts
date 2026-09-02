import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProviderCoordinatesAndTokens1787944489439 implements MigrationInterface {
    name = 'AddProviderCoordinatesAndTokens1787944489439';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add coordinates to providers table if not present
        await queryRunner.query(`ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "latitude" float`);
        await queryRunner.query(`ALTER TABLE "providers" ADD COLUMN IF NOT EXISTS "longitude" float`);

        // Add pushToken and devicePlatform to notification_preferences table
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "pushToken" varchar`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "devicePlatform" varchar`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "devicePlatform"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "pushToken"`);
        await queryRunner.query(`ALTER TABLE "providers" DROP COLUMN IF EXISTS "longitude"`);
        await queryRunner.query(`ALTER TABLE "providers" DROP COLUMN IF EXISTS "latitude"`);
    }
}
