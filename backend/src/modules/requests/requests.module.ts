import { Module } from "@nestjs/common";
import { ServiceRequestsService } from "./requests.service";
import { ServiceRequestsController } from "./requests.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
