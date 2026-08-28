import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DatabaseSeedService } from "./database/seed";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const action = process.argv[2];

  if (!action || (action !== "reset" && action !== "seed")) {
    console.error("Usage: ts-node src/db-control.ts [reset|seed]");
    process.exit(1);
  }

  console.log(`Starting NestJS context (NODE_ENV=${process.env.NODE_ENV || "not set"})...`);
  
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    if (action === "reset") {
      console.log("Dropping database and running migrations...");
      const dataSource = app.get(DataSource);
      await dataSource.dropDatabase();
      await dataSource.runMigrations();
      console.log("Database reset completed successfully!");
    } else if (action === "seed") {
      if (process.env.NODE_ENV === "production") {
        console.error("CRITICAL: Database seeding is disabled in production environments.");
        await app.close();
        process.exit(1);
      }
      console.log("Executing seed sequence...");
      const seeder = app.get(DatabaseSeedService);
      await seeder.seed();
      console.log("Database seeding completed successfully!");
    }
  } catch (error) {
    console.error(`Error executing database action ${action}:`, error);
    await app.close();
    process.exit(1);
  }

  await app.close();
  console.log("NestJS context closed.");
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
