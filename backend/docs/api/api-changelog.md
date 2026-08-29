# Merihcare API Change Log

## [1.0.0] - 2026-08-29
### Initial Production Release
* Standardized response envelope `{ success: true, data: T, timestamp, correlationId }` across all endpoints.
* Introduced standardized error catalog with machine-readable error codes (`VALIDATION_FAILED`, `UNAUTHORIZED`, `DOUBLE_BOOKING_CONFLICT`, etc.).
* Implemented HMAC SHA-256 signature verification on all inbound payment webhooks (Telebirr, CBE Birr, Chapa, Stripe).
* Integrated OpenAPI 3.0 swagger contract documentation at `/api/docs`.
* Enforced RBAC and Resource Ownership isolation across patients, providers, and admin roles.
* Added deep `/health/readiness` and `/health/liveness` subsystem diagnostic probes.
