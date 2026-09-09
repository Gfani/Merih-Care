import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServiceRequestsService } from "./requests.service";
import { ServiceRequestsController } from "./requests.controller";
import { AuthModule } from "../auth/auth.module";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([AppointmentEntity])],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
