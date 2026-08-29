import { TransformInterceptor } from "../src/shared/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/shared/filters/http-exception.filter";
import { PaginatedResponseDto } from "../src/shared/dtos/paginated-response.dto";
import { BadRequestException, UnauthorizedException, ForbiddenException, NotFoundException, ConflictException } from "@nestjs/common";
import { of } from "rxjs";

describe("API Contract & Response Envelope Tests", () => {
  describe("TransformInterceptor (Success Envelope)", () => {
    let interceptor: TransformInterceptor<any>;

    beforeEach(() => {
      interceptor = new TransformInterceptor();
    });

    it("should wrap response in standard envelope with success, timestamp, and correlationId", (done) => {
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            url: "/api/v1/users",
            headers: { "x-correlation-id": "test-corr-123" },
          }),
        }),
      };

      const mockCallHandler: any = {
        handle: () => of([{ id: "u-1", name: "Dr. Bereket" }]),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result: any) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual([{ id: "u-1", name: "Dr. Bereket" }]);
        expect(result.correlationId).toBe("test-corr-123");
        expect(result.timestamp).toBeDefined();
        done();
      });
    });
  });

  describe("HttpExceptionFilter (Error Envelope & Error Codes)", () => {
    let filter: HttpExceptionFilter;
    let mockResponse: any;
    let mockRequest: any;
    let mockHost: any;

    beforeEach(() => {
      filter = new HttpExceptionFilter();
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockRequest = {
        url: "/api/v1/appointments",
        headers: { "x-correlation-id": "err-corr-456" },
      };
      mockHost = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => mockRequest,
        }),
      };
    });

    it("should map 400 BadRequest to VALIDATION_FAILED error code", () => {
      filter.catch(new BadRequestException("Invalid date format"), mockHost);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
          errorCode: "VALIDATION_FAILED",
          correlationId: "err-corr-456",
        })
      );
    });

    it("should map 401 Unauthorized to UNAUTHORIZED error code", () => {
      filter.catch(new UnauthorizedException("Token expired"), mockHost);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 401,
          errorCode: "UNAUTHORIZED",
        })
      );
    });

    it("should map 403 Forbidden to FORBIDDEN_ACCESS error code", () => {
      filter.catch(new ForbiddenException("Insufficient permissions"), mockHost);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 403,
          errorCode: "FORBIDDEN_ACCESS",
        })
      );
    });

    it("should map 404 NotFound to RESOURCE_NOT_FOUND error code", () => {
      filter.catch(new NotFoundException("Appointment not found"), mockHost);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 404,
          errorCode: "RESOURCE_NOT_FOUND",
        })
      );
    });

    it("should map 409 Conflict to CONFLICT_STATE error code", () => {
      filter.catch(new ConflictException("Double booking conflict"), mockHost);
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 409,
          errorCode: "CONFLICT_STATE",
        })
      );
    });
  });

  describe("Pagination Schema Integrity", () => {
    it("should structure PaginatedResponseDto with accurate pagination metadata", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const paginated = new PaginatedResponseDto(items, 25, 2, 3);

      expect(paginated.items).toHaveLength(3);
      expect(paginated.meta.total).toBe(25);
      expect(paginated.meta.page).toBe(2);
      expect(paginated.meta.limit).toBe(3);
      expect(paginated.meta.totalPages).toBe(9);
      expect(paginated.meta.hasMore).toBe(true);
    });
  });
});
