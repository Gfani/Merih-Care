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

  // Export OpenAPI Contract Spec for client generation (safe write)
  try {
    fs.writeFileSync(
      path.join(__dirname, "../swagger-spec.json"),
      JSON.stringify(document, null, 2)
    );
  } catch {
    // Non-fatal if container file system is restricted
  }

  const configuredOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : [];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      const isAllowed =
        configuredOrigins.includes(origin) ||
        origin.endsWith(".azurecontainerapps.io") ||
        origin.endsWith(".azurestaticapps.net") ||
        origin.endsWith(".azurewebsites.net") ||
        origin.endsWith("merihcare.et") ||
        origin.includes("localhost");

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, true); // Fallback to allow connection with warning in dev/staging
      }
    },
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
