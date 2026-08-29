import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    return this.healthService.checkHealth();
  }

  @Get("liveness")
  async getLiveness() {
    return this.healthService.checkLiveness();
  }

  @Get("readiness")
  async getReadiness() {
    return this.healthService.checkReadiness();
  }
}
