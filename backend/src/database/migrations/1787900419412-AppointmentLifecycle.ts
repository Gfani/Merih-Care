import { MigrationInterface, QueryRunner } from "typeorm";

export class AppointmentLifecycle1787900419412 implements MigrationInterface {
    name = 'AppointmentLifecycle1787900419412'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_3007a47d97a542e63b3308a69b"`);
        await queryRunner.query(`DROP INDEX "IDX_6b8e84de5d15269b7f79187992"`);
        await queryRunner.query(`DROP INDEX "IDX_f77953c373efb8ab146d98e90c"`);
        await queryRunner.query(`DROP INDEX "IDX_2428e01f899c4edb909e8798b6"`);
        await queryRunner.query(`DROP INDEX "IDX_13c2e57cb81b44f062ba24df57"`);
        await queryRunner.query(`CREATE TABLE "temporary_appointments" ("id" varchar PRIMARY KEY NOT NULL, "patientId" varchar, "providerId" varchar, "serviceId" varchar, "patientName" varchar, "patientAvatar" varchar, "providerName" varchar, "providerAvatar" varchar, "service" varchar, "date" varchar NOT NULL, "time" varchar NOT NULL, "location" varchar, "amount" integer NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT ('pending'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "version" integer NOT NULL, "visitNotes" varchar, "disputeReason" varchar, "cancelledBy" varchar, "cancellationReason" varchar, CONSTRAINT "FK_f77953c373efb8ab146d98e90c3" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2428e01f899c4edb909e8798b63" FOREIGN KEY ("providerId") REFERENCES "providers" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d" FOREIGN KEY ("patientId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_appointments"("id", "patientId", "providerId", "serviceId", "patientName", "patientAvatar", "providerName", "providerAvatar", "service", "date", "time", "location", "amount", "status", "createdAt", "updatedAt", "deletedAt", "version") SELECT "id", "patientId", "providerId", "serviceId", "patientName", "patientAvatar", "providerName", "providerAvatar", "service", "date", "time", "location", "amount", "status", "createdAt", "updatedAt", "deletedAt", "version" FROM "appointments"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`ALTER TABLE "temporary_appointments" RENAME TO "appointments"`);
        await queryRunner.query(`CREATE INDEX "IDX_3007a47d97a542e63b3308a69b" ON "appointments" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b8e84de5d15269b7f79187992" ON "appointments" ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_f77953c373efb8ab146d98e90c" ON "appointments" ("serviceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2428e01f899c4edb909e8798b6" ON "appointments" ("providerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_13c2e57cb81b44f062ba24df57" ON "appointments" ("patientId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_13c2e57cb81b44f062ba24df57"`);
        await queryRunner.query(`DROP INDEX "IDX_2428e01f899c4edb909e8798b6"`);
        await queryRunner.query(`DROP INDEX "IDX_f77953c373efb8ab146d98e90c"`);
        await queryRunner.query(`DROP INDEX "IDX_6b8e84de5d15269b7f79187992"`);
        await queryRunner.query(`DROP INDEX "IDX_3007a47d97a542e63b3308a69b"`);
        await queryRunner.query(`ALTER TABLE "appointments" RENAME TO "temporary_appointments"`);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" varchar PRIMARY KEY NOT NULL, "patientId" varchar, "providerId" varchar, "serviceId" varchar, "patientName" varchar, "patientAvatar" varchar, "providerName" varchar, "providerAvatar" varchar, "service" varchar, "date" varchar NOT NULL, "time" varchar NOT NULL, "location" varchar, "amount" integer NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT ('pending'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "version" integer NOT NULL, CONSTRAINT "FK_f77953c373efb8ab146d98e90c3" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2428e01f899c4edb909e8798b63" FOREIGN KEY ("providerId") REFERENCES "providers" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_13c2e57cb81b44f062ba24df57d" FOREIGN KEY ("patientId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "appointments"("id", "patientId", "providerId", "serviceId", "patientName", "patientAvatar", "providerName", "providerAvatar", "service", "date", "time", "location", "amount", "status", "createdAt", "updatedAt", "deletedAt", "version") SELECT "id", "patientId", "providerId", "serviceId", "patientName", "patientAvatar", "providerName", "providerAvatar", "service", "date", "time", "location", "amount", "status", "createdAt", "updatedAt", "deletedAt", "version" FROM "temporary_appointments"`);
        await queryRunner.query(`DROP TABLE "temporary_appointments"`);
        await queryRunner.query(`CREATE INDEX "IDX_13c2e57cb81b44f062ba24df57" ON "appointments" ("patientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2428e01f899c4edb909e8798b6" ON "appointments" ("providerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f77953c373efb8ab146d98e90c" ON "appointments" ("serviceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b8e84de5d15269b7f79187992" ON "appointments" ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_3007a47d97a542e63b3308a69b" ON "appointments" ("status") `);
    }

}
