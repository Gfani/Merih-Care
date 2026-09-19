import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { HttpExceptionFilter } from "./shared/filters/http-exception.filter";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";
import { IdempotencyInterceptor } from "./shared/interceptors/idempotency.interceptor";
import { TransformInterceptor } from "./shared/interceptors/transform.interceptor";
import helmet from "helmet";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");
import { RedisIoAdapter } from "./modules/realtime/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Attach multi-node Redis WebSocket adapter
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameAncestors: [
          "'self'",
          "https://*.merihcare.live",
          "https://merihcare.live",
          "http://localhost:*",
          "http://127.0.0.1:*",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: false,
  }));

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

  const productionAllowlist = [
    "https://admin.merihcare.live",
    "https://merihcare.live",
    "https://app.merihcare.live",
    "https://merihcare.et",
    "https://admin.merihcare.et",
    "https://app.merihcare.et",
    ...configuredOrigins,
  ].filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    const weakSecrets = [
      "super_secret_jwt_key_change_me_in_production",
      "secret",
      "change_me",
    ];
    if (!process.env.JWT_SECRET || weakSecrets.includes(process.env.JWT_SECRET)) {
      console.warn("WARNING: JWT_SECRET is set to an insecure default placeholder. Set a strong random secret before public launch.");
    }
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile native apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      // Enforce strict exact-origin matching
      const isAllowed = productionAllowlist.includes(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy violation: Origin '${origin}' is not permitted by Merihcare Access Control.`), false);
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
  await app.listen(port, "0.0.0.0");
  console.log(`Application is running on: http://0.0.0.0:${port}/api/v1`);
}
bootstrap().catch((err) => {
  console.error("Fatal error during backend bootstrap:", err);
  process.exit(1);
});
