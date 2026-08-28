import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateLocationsSchema1787904046847 implements MigrationInterface {
    name = 'UpdateLocationsSchema1787904046847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_8254957861f5dca75bfeef3f15"`);
        await queryRunner.query(`DROP INDEX "IDX_78eda52dc27b7ad20350c4a752"`);
        await queryRunner.query(`CREATE TABLE "temporary_locations" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar, "name" varchar, "role" varchar NOT NULL, "x" float NOT NULL, "y" float NOT NULL, "status" varchar NOT NULL DEFAULT ('available'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "accuracy" float DEFAULT (0), "privacyMode" boolean NOT NULL DEFAULT (0), "locationTimestamp" varchar, CONSTRAINT "FK_78eda52dc27b7ad20350c4a752d" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_locations"("id", "userId", "name", "role", "x", "y", "status", "createdAt", "updatedAt", "deletedAt") SELECT "id", "userId", "name", "role", "x", "y", "status", "createdAt", "updatedAt", "deletedAt" FROM "locations"`);
        await queryRunner.query(`DROP TABLE "locations"`);
        await queryRunner.query(`ALTER TABLE "temporary_locations" RENAME TO "locations"`);
        await queryRunner.query(`CREATE INDEX "IDX_8254957861f5dca75bfeef3f15" ON "locations" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_78eda52dc27b7ad20350c4a752" ON "locations" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_78eda52dc27b7ad20350c4a752"`);
        await queryRunner.query(`DROP INDEX "IDX_8254957861f5dca75bfeef3f15"`);
        await queryRunner.query(`ALTER TABLE "locations" RENAME TO "temporary_locations"`);
        await queryRunner.query(`CREATE TABLE "locations" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar, "name" varchar, "role" varchar NOT NULL, "x" float NOT NULL, "y" float NOT NULL, "status" varchar NOT NULL DEFAULT ('available'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, CONSTRAINT "FK_78eda52dc27b7ad20350c4a752d" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "locations"("id", "userId", "name", "role", "x", "y", "status", "createdAt", "updatedAt", "deletedAt") SELECT "id", "userId", "name", "role", "x", "y", "status", "createdAt", "updatedAt", "deletedAt" FROM "temporary_locations"`);
        await queryRunner.query(`DROP TABLE "temporary_locations"`);
        await queryRunner.query(`CREATE INDEX "IDX_78eda52dc27b7ad20350c4a752" ON "locations" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8254957861f5dca75bfeef3f15" ON "locations" ("status") `);
    }

}
