import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDocumentsTable1787944489442 implements MigrationInterface {
  name = "CreateDocumentsTable1787944489442";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === "postgres";

    if (isPostgres) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "documents" (
          "id" varchar PRIMARY KEY NOT NULL,
          "fileKey" varchar UNIQUE NOT NULL,
          "ownerId" varchar NOT NULL,
          "documentType" varchar NOT NULL DEFAULT 'credential',
          "fileName" varchar NOT NULL,
          "fileSize" integer NOT NULL DEFAULT 0,
          "mimeType" varchar NOT NULL DEFAULT 'application/octet-stream',
          "verifierId" varchar,
          "fileData" text,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documents_fileKey" ON "documents" ("fileKey")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documents_ownerId" ON "documents" ("ownerId")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documents_verifierId" ON "documents" ("verifierId")`);
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "documents" (
          "id" varchar PRIMARY KEY NOT NULL,
          "fileKey" varchar UNIQUE NOT NULL,
          "ownerId" varchar NOT NULL,
          "documentType" varchar NOT NULL DEFAULT 'credential',
          "fileName" varchar NOT NULL,
          "fileSize" integer NOT NULL DEFAULT 0,
          "mimeType" varchar NOT NULL DEFAULT 'application/octet-stream',
          "verifierId" varchar,
          "fileData" text,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
          "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documents_fileKey" ON "documents" ("fileKey")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documents_ownerId" ON "documents" ("ownerId")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documents_verifierId" ON "documents" ("verifierId")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
  }
}
