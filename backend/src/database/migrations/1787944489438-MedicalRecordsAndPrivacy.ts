import { MigrationInterface, QueryRunner } from "typeorm";

export class MedicalRecordsAndPrivacy1787944489438 implements MigrationInterface {
    name = 'MedicalRecordsAndPrivacy1787944489438'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "medical_records" ("id" varchar PRIMARY KEY NOT NULL, "patientId" varchar NOT NULL, "providerId" varchar, "diagnosis" text NOT NULL, "notes" text NOT NULL, "attachments" text, "createdAt" varchar NOT NULL, "updatedAt" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_7c2c9d4fe663e3330d503bf440" ON "medical_records" ("patientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ae81683c2a496189a5c8d4214" ON "medical_records" ("providerId") `);
        await queryRunner.query(`CREATE TABLE "patient_consents" ("id" varchar PRIMARY KEY NOT NULL, "patientId" varchar NOT NULL, "providerId" varchar NOT NULL, "granted" boolean NOT NULL DEFAULT (0), "expiresAt" varchar NOT NULL, "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_14e8f8d08c99f3a91b5dcc0499" ON "patient_consents" ("patientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_393a8b5008fd85c0c983209cb4" ON "patient_consents" ("providerId") `);
        await queryRunner.query(`CREATE TABLE "privacy_policy_acceptances" ("userId" varchar PRIMARY KEY NOT NULL, "acceptedAt" varchar NOT NULL, "policyVersion" varchar NOT NULL)`);
        await queryRunner.query(`CREATE TABLE "incident_reports" ("id" varchar PRIMARY KEY NOT NULL, "reporterId" varchar NOT NULL, "title" varchar NOT NULL, "description" text NOT NULL, "status" varchar NOT NULL DEFAULT ('pending'), "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_ce3d0cb1e986300735da8b75ae" ON "incident_reports" ("reporterId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_ce3d0cb1e986300735da8b75ae"`);
        await queryRunner.query(`DROP TABLE "incident_reports"`);
        await queryRunner.query(`DROP TABLE "privacy_policy_acceptances"`);
        await queryRunner.query(`DROP INDEX "IDX_393a8b5008fd85c0c983209cb4"`);
        await queryRunner.query(`DROP INDEX "IDX_14e8f8d08c99f3a91b5dcc0499"`);
        await queryRunner.query(`DROP TABLE "patient_consents"`);
        await queryRunner.query(`DROP INDEX "IDX_2ae81683c2a496189a5c8d4214"`);
        await queryRunner.query(`DROP INDEX "IDX_7c2c9d4fe663e3330d503bf440"`);
        await queryRunner.query(`DROP TABLE "medical_records"`);
    }

}
