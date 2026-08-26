import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmergencyService } from "./emergency.service";
import { EmergencyController } from "./emergency.controller";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([EmergencyEntity]),
    AuthModule,
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
