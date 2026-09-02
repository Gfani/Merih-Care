import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException 
      ? exception.getResponse() 
      : { message: "Internal server error" };

    const message = typeof exceptionResponse === "object" && exceptionResponse["message"] 
      ? exceptionResponse["message"] 
      : exception.message || "An unexpected error occurred";

    const error = typeof exceptionResponse === "object" && exceptionResponse["error"]
      ? exceptionResponse["error"]
      : "Internal Server Error";

    let errorCode = "INTERNAL_SERVER_ERROR";
    if (status === 400) errorCode = "VALIDATION_FAILED";
    else if (status === 401) errorCode = "UNAUTHORIZED";
    else if (status === 403) errorCode = "FORBIDDEN_ACCESS";
    else if (status === 404) errorCode = "RESOURCE_NOT_FOUND";
    else if (status === 409) errorCode = "CONFLICT_STATE";
    else if (status === 429) errorCode = "RATE_LIMIT_EXCEEDED";

    const correlationId = (request.headers["x-correlation-id"] as string) || request["id"] || `corr-${Date.now()}`;

    console.error(`[Correlation ID: ${correlationId}] Error ${status} (${errorCode}): ${JSON.stringify(message)} at ${request.url}`);
    if (status === 500) {
      console.error(exception?.stack || exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId,
      error,
      message: Array.isArray(message) ? message : [message],
    });
  }
}
