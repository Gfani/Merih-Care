import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { HttpExceptionFilter } from "./shared/filters/http-exception.filter";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";
import { IdempotencyInterceptor } from "./shared/interceptors/idempotency.interceptor";
import { TransformInterceptor } from "./shared/interceptors/transform.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");

  // Production Secrets Isolation Check
  if (process.env.NODE_ENV === "production") {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === "default_secret" || jwtSecret === "secret_key") {
      throw new Error("[SECURITY FATAL] Default placeholder JWT_SECRET detected in production environment!");
    }
  }

  // Setup Swagger API Contract Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Merihcare API Specification")
    .setDescription("Comprehensive API contract documentation for Merihcare clinics, users, and administrative portals.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // Export OpenAPI Contract Spec for client generation
  fs.writeFileSync(
    path.join(__dirname, "../swagger-spec.json"),
    JSON.stringify(document, null, 2)
  );

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : process.env.NODE_ENV === "production"
    ? ["https://admin.merihcare.et", "https://app.merihcare.et"]
    : true;

  app.enableCors({
    origin: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new IdempotencyInterceptor(), new TransformInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
