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

  @Get("app-version")
  async getAppVersion() {
    return {
      minimumSupportedVersion: "1.0.0",
      latestVersion: "1.0.0",
      forceUpdate: false,
      updateUrl: "https://play.google.com/store/apps/details?id=et.merihcare.app",
      releaseNotes: "Production release of MerihCare Healthcare Services.",
    };
  }
}
