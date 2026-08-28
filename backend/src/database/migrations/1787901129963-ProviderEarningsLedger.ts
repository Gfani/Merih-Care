import { MigrationInterface, QueryRunner } from "typeorm";

export class ProviderEarningsLedger1787901129963 implements MigrationInterface {
    name = 'ProviderEarningsLedger1787901129963'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "provider_earnings" ("providerId" varchar PRIMARY KEY NOT NULL, "balance" integer NOT NULL DEFAULT (0), "totalEarned" integer NOT NULL DEFAULT (0), "totalWithdrawn" integer NOT NULL DEFAULT (0), "updatedAt" varchar NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "provider_earnings"`);
    }

}
