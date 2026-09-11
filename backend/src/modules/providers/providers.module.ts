import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProvidersService } from "./providers.service";
import { ProvidersController } from "./providers.controller";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProviderEntity, UserEntity]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
