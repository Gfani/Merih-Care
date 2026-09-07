import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProviderCredentialFields1787944489441 implements MigrationInterface {
  name = "AddProviderCredentialFields1787944489441";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      { name: "licenseNumber", type: "varchar" },
      { name: "specialty", type: "varchar" },
      { name: "education", type: "varchar" },
      { name: "hospitalAffiliation", type: "varchar" },
      { name: "cvUrl", type: "varchar" },
      { name: "licenseDocumentUrl", type: "varchar" },
      { name: "idDocumentUrl", type: "varchar" },
    ];

    for (const col of columns) {
      try {
        await queryRunner.query(
          `ALTER TABLE "providers" ADD COLUMN "${col.name}" ${col.type}`
        );
      } catch (e: any) {
        // Ignore duplicate column errors if already applied
        if (!e.message?.includes("duplicate column") && !e.message?.includes("already exists")) {
          console.warn(`[MIGRATION] Notice on adding ${col.name}: ${e.message}`);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const colNames = [
      "idDocumentUrl",
      "licenseDocumentUrl",
      "cvUrl",
      "hospitalAffiliation",
      "education",
      "specialty",
      "licenseNumber",
    ];

    for (const col of colNames) {
      try {
        await queryRunner.query(`ALTER TABLE "providers" DROP COLUMN "${col}"`);
      } catch (e: any) {
        // ignore
      }
    }
  }
}
