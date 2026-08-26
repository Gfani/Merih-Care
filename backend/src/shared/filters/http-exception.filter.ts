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
      : exception.message;

    const error = typeof exceptionResponse === "object" && exceptionResponse["error"]
      ? exceptionResponse["error"]
      : "Internal Server Error";

    const requestId = request["id"] || "unknown";

    console.error(`[Request ID: ${requestId}] Error: ${JSON.stringify(message)} at path ${request.url}`);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      error,
      message: Array.isArray(message) ? message : [message],
    });
  }
}
