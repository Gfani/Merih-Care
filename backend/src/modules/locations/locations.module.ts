import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LocationsService } from "./locations.service";
import { LocationsController } from "./locations.controller";
import { LocationEntity } from "../../database/entities/location.entity";
import { LocationHistoryEntity } from "../../database/entities/emergency-relation.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationEntity, LocationHistoryEntity]),
    AuthModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
