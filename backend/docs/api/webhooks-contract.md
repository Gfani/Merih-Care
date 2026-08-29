# Merihcare Inbound Webhook Contract Specification

## 1. Endpoints
* **Telebirr**: `POST /api/v1/payments/webhook/telebirr`
* **CBE Birr**: `POST /api/v1/payments/webhook/cbe-birr`
* **Chapa**: `POST /api/v1/payments/webhook/chapa`
* **Stripe**: `POST /api/v1/payments/webhook/stripe`

---

## 2. Signature Verification
Every inbound webhook request MUST include a cryptographic signature header (`x-chapa-signature`, `x-telebirr-signature`, or `stripe-signature`).

```typescript
const computedSignature = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

const isValid = crypto.timingSafeEqual(
  Buffer.from(signatureHeader),
  Buffer.from(computedSignature)
);
```

If signatures do not match, the request is rejected with HTTP 401 `SIGNATURE_VERIFICATION_FAILED`.

---

## 3. Webhook Payload Schema

```json
{
  "event": "payment.success",
  "data": {
    "transactionRef": "TX-94821",
    "appointmentId": "apt-101",
    "amount": 1500,
    "currency": "ETB",
    "status": "completed",
    "settlement": {
      "providerPayout": 1275,
      "platformCommission": 225
    }
  },
  "timestamp": "2026-08-29T12:00:00.000Z"
}
```

---

## 4. Idempotency & Retry Schedule
* Webhooks store `transactionRef` in `webhook_event_logs` to guarantee strict idempotency. Duplicate delivery attempts return HTTP 200 with cached acknowledgments.
* Failed deliveries are retried via exponential backoff (1m, 5m, 15m, 1h, 6h).
