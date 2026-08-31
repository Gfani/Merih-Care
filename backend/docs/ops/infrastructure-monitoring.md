# Merihcare Infrastructure Monitoring & Alerting Architecture

## 1. Health Checks
- Backend endpoint: `GET /api/v1/health` verifies database connection pool, Redis liveness, memory usage, and storage connectivity.
- Uptime probe: Configured to ping `/api/v1/health` every 30 seconds with 5-second timeout.

## 2. Structured Logging
- JSON structured logs formatted with:
  - `timestamp`: ISO 8601
  - `correlationId`: Distributed request tracing UUID
  - `level`: `INFO`, `WARN`, `ERROR`
  - `context`: Service module name
  - `message`: Payload description

## 3. Downtime & Error Alerting
- Sentry integration captures uncaught backend exceptions.
- Webhook notifications route to Slack/PagerDuty when consecutive health check failures exceed 3 cycles.
