import { IoAdapter } from "@nestjs/platform-socket.io";
import { ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Logger } from "@nestjs/common";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;

    // If no Redis config provided, skip to in-memory adapter
    if (!redisUrl && !redisHost) {
      this.logger.log("No Redis configuration provided: using in-memory WebSocket adapter.");
      return;
    }

    const retryStrategy = (times: number) => {
      if (times > 3) {
        return null; // Stop retrying so local/offline dev is not blocked
      }
      return Math.min(times * 150, 1000);
    };

    try {
      let pubClient: Redis;
      if (redisUrl) {
        pubClient = new Redis(redisUrl, {
          retryStrategy,
          connectTimeout: 2500,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
        });
      } else {
        const host = redisHost || "127.0.0.1";
        const port = Number(process.env.REDIS_PORT) || 6379;
        const password = process.env.REDIS_PASSWORD || undefined;

        pubClient = new Redis({
          host,
          port,
          password: password || undefined,
          retryStrategy,
          connectTimeout: 2500,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
        });
      }

      const subClient = pubClient.duplicate();

      pubClient.on("error", (err) => {
        this.logger.debug(`Redis pubClient error: ${err.message}`);
      });
      subClient.on("error", (err) => {
        this.logger.debug(`Redis subClient error: ${err.message}`);
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log("Multi-node Redis WebSocket adapter connected and initialized successfully.");
    } catch (err: any) {
      this.logger.warn(`Redis connection failed (${err.message}). Gracefully falling back to in-memory WebSocket adapter.`);
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
