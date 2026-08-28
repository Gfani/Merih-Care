import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuthModule } from "../auth/auth.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogEntity } from "../../database/entities/logs-delivery.entity";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([AuditLogEntity]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
