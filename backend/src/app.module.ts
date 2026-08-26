import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getDatabaseConfig } from "./database/database.config";
import { 
  UserEntity, 
  ProviderEntity, 
  ServiceEntity, 
  AppointmentEntity, 
  ComplaintEntity, 
  ReviewEntity, 
  EmergencyEntity, 
  LocationEntity 
} from "./database/entities";
import { DatabaseSeedService } from "./database/seed";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    // Load config globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : ".env",
    }),
    
    // Connect Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),

    // Load entities for repository injection
    TypeOrmModule.forFeature([
      UserEntity,
      ProviderEntity,
      ServiceEntity,
      AppointmentEntity,
      ComplaintEntity,
      ReviewEntity,
      EmergencyEntity,
      LocationEntity
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseSeedService,
  ],
})
export class AppModule {}
