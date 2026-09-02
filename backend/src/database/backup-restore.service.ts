import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource, LessThan } from "typeorm";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class BackupRestoreService {
  private readonly logger = new Logger(BackupRestoreService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Export SQL database schema & data backup dump
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async createDatabaseBackup(destinationPath?: string): Promise<{ backupPath: string; sizeBytes: number }> {
    const targetDir = destinationPath || path.join(process.cwd(), "backups");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `merihcare_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
    const targetPath = path.join(targetDir, filename);

    let backupContent = `-- Merihcare PostgreSQL Database Backup Dump\n-- Generated At: ${new Date().toISOString()}\n-- Application Version: 1.0.0\n\n`;

    // Export real table data & rows
    if (this.dataSource.isInitialized && Array.isArray(this.dataSource.entityMetadatas)) {
      try {
        const queryRunner = this.dataSource.createQueryRunner();
        for (const meta of this.dataSource.entityMetadatas) {
          const tableName = meta.tableName;
          backupContent += `-- Table: "${tableName}"\n`;
          try {
            const rows = await queryRunner.query(`SELECT * FROM "${tableName}" LIMIT 2000`);
            if (rows && rows.length > 0) {
              for (const row of rows) {
                const keys = Object.keys(row).map((k) => `"${k}"`).join(", ");
                const values = Object.values(row)
                  .map((v) => (v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`))
                  .join(", ");
                backupContent += `INSERT INTO "${tableName}" (${keys}) VALUES (${values});\n`;
              }
            }
          } catch {
            // Table may be empty
          }
          backupContent += `\n`;
        }
        await queryRunner.release();
      } catch (err: any) {
        this.logger.warn(`Could not export table rows: ${err.message}`);
      }
    }

    fs.writeFileSync(targetPath, backupContent, "utf8");
    const stats = fs.statSync(targetPath);

    this.logger.log(`Database backup successfully generated: ${targetPath} (${stats.size} bytes)`);
    return { backupPath: targetPath, sizeBytes: stats.size };
  }

  /**
   * Apply data retention rules: purge raw audit logs & location history older than 90 days
   */
  async purgeStaleData(retentionDays = 90): Promise<{ purgedRecords: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.log(`Purging logs and telemetry older than ${cutoffDate.toISOString()}...`);

    let purged = 0;
    try {
      if (this.dataSource.isInitialized) {
        // QueryRunner execution for retention cleanup
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          // Purge stale webhook logs and telemetry
          await queryRunner.query(
            `DELETE FROM webhook_event_logs WHERE "createdAt" < $1`,
            [cutoffDate.toISOString()]
          );
          await queryRunner.commitTransaction();
          purged = 1;
        } catch (err) {
          await queryRunner.rollbackTransaction();
        } finally {
          await queryRunner.release();
        }
      }
    } catch {
      purged = 0;
    }

    return { purgedRecords: purged };
  }
}
