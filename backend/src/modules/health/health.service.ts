import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async checkHealth(): Promise<any> {
    const dbConnected = this.dataSource.isInitialized;
    return {
      status: dbConnected ? "up" : "down",
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? "up" : "down",
      }
    };
  }
}
