import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UploadsService } from "./uploads.service";
import { UploadsController } from "./uploads.controller";
import { AuthModule } from "../auth/auth.module";
import { DocumentEntity } from "../../database/entities/document.entity";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([DocumentEntity]),
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
