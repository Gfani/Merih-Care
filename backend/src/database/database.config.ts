import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { 
  UserEntity, 
  ProviderEntity, 
  ServiceEntity, 
  AppointmentEntity, 
  ComplaintEntity, 
  ReviewEntity, 
  EmergencyEntity, 
  LocationEntity 
} from "./entities";

export const getDatabaseConfig = (configService: any): TypeOrmModuleOptions => {
  const dbType = process.env.DB_TYPE || "postgres";

  const entities = [
    UserEntity,
    ProviderEntity,
    ServiceEntity,
    AppointmentEntity,
    ComplaintEntity,
    ReviewEntity,
    EmergencyEntity,
    LocationEntity
  ];

  if (dbType === "sqlite") {
    return {
      type: "sqlite",
      database: process.env.DB_DATABASE || "merihcare.sqlite",
      entities,
      synchronize: true, // Automatically synchronize schema in development
    };
  }

  // Fallback to PostgreSQL
  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "merihcare_user",
    password: process.env.DB_PASSWORD || "merihcare_password",
    database: process.env.DB_DATABASE || "merihcare_db",
    entities,
    synchronize: true,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
};
