import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UserEntity } from "../../database/entities/user.entity";
import { SessionEntity } from "../../database/entities/session.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { NotificationsModule } from "../notifications/notifications.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SessionEntity, ProviderEntity]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => RealtimeModule),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "super_secret_jwt_key_change_me_in_production",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
