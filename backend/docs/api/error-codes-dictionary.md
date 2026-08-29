# Merihcare Standard Error Codes Dictionary

All errors emitted by the Merihcare backend adhere to the standard envelope:
```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "timestamp": "2026-08-29T12:00:00.000Z",
  "path": "/api/v1/appointments",
  "correlationId": "corr-1787820000000",
  "error": "Bad Request",
  "message": [
    "service must be a string",
    "amount must be a positive number"
  ]
}
```

---

## Error Codes Catalog

| HTTP Status | Machine-Readable Error Code | Trigger Condition | Recommended Client Action |
| :--- | :--- | :--- | :--- |
| **400** | `VALIDATION_FAILED` | Request payload failed class-validator DTO constraints | Display inline form field error messages |
| **400** | `INVALID_STATE_TRANSITION` | Illegal appointment or request lifecycle transition | Refresh appointment status from backend |
| **401** | `UNAUTHORIZED` | Missing, expired, or invalid JWT Bearer token | Prompt user to log in again / refresh token |
| **401** | `SIGNATURE_VERIFICATION_FAILED` | Webhook signature HMAC digest mismatch | Verify secret key configuration on gateway |
| **403** | `FORBIDDEN_ACCESS` | User role does not hold required privileges or resource ownership | Display access restricted screen |
| **404** | `RESOURCE_NOT_FOUND` | The requested entity ID does not exist | Show 404 empty state |
| **409** | `CONFLICT_STATE` | Concurrency lock or state mismatch | Retry request with updated state |
| **409** | `DOUBLE_BOOKING_CONFLICT` | Overlapping booking slot already occupied for provider | Select an alternative available time slot |
| **409** | `IDEMPOTENCY_CONFLICT` | Concurrent request with identical idempotency key | Await completion of original request |
| **429** | `RATE_LIMIT_EXCEEDED` | Exceeded 100 requests / min throttler limit | Back off and retry after `Retry-After` seconds |
| **500** | `INTERNAL_SERVER_ERROR` | Unhandled server exception | Display generic retry toast; alert backend ops |
