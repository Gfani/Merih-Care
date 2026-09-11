import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { UserEntity } from "../../database/entities/user.entity";
import { AuthModule } from "../auth/auth.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    AuthModule,
    RealtimeModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
