import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmergencyService } from "./emergency.service";
import { EmergencyController } from "./emergency.controller";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import {
  EmergencyResponderEntity,
  EmergencyEscalationHistoryEntity,
} from "../../database/entities/emergency-relation.entity";
import { AuthModule } from "../auth/auth.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmergencyEntity,
      EmergencyResponderEntity,
      EmergencyEscalationHistoryEntity,
    ]),
    AuthModule,
    RealtimeModule,
  ],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
