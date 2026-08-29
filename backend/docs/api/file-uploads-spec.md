# Merihcare File Upload Specification

## 1. Endpoint
`POST /api/v1/uploads` (`multipart/form-data`)

---

## 2. File Upload Constraints & Security Rules

| Rule | Enforcement | Rejection Status |
| :--- | :--- | :--- |
| **Max Payload Size** | 10 MB ($10,485,760$ bytes) per file | HTTP 400 `PAYLOAD_TOO_LARGE` |
| **Whitelisted MIME Types** | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` | HTTP 400 `INVALID_FILE_TYPE` |
| **Dangerous Executables** | Rejects `.exe`, `.sh`, `.php`, `.js`, `.bat`, `.cmd`, `.py` | HTTP 400 `MALICIOUS_FILE_TYPE` |
| **Storage Destination** | Isolated S3 / local volume storage with randomized nonces | — |

---

## 3. Upload Response Envelope

```json
{
  "success": true,
  "data": {
    "fileId": "file-94827-uuid",
    "filename": "doctor-license-scan.pdf",
    "mimetype": "application/pdf",
    "sizeBytes": 245910,
    "url": "https://storage.merihcare.et/uploads/doctor-license-scan.pdf"
  },
  "timestamp": "2026-08-29T12:00:00.000Z",
  "correlationId": "corr-1787820000000"
}
```
