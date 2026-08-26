import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req["id"] = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}
