import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";
import { PresenceService } from "./presence.service";
import { LocationEntity } from "../../database/entities/location.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentsModule } from "../appointments/appointments.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationEntity, AppointmentEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get("JWT_SECRET") || "merihcare-secret",
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => AppointmentsModule),
  ],
  providers: [RealtimeGateway, RealtimeService, PresenceService],
  exports: [RealtimeService, PresenceService],
})
export class RealtimeModule {}
