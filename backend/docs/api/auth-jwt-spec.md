# Merihcare Authentication & JWT Specification

## 1. Authentication Flow
Merihcare uses OAuth2 Resource Owner Password / Authorization credentials yielding HMAC SHA-256 JWT Bearer access tokens.

All protected API endpoints require:
```http
Authorization: Bearer <access_token>
```

---

## 2. JWT Payload Claims Schema

```json
{
  "sub": "u-admin-1",
  "email": "admin@merihcare.et",
  "role": "super_admin",
  "department": "Executive",
  "iat": 1787820000,
  "exp": 1787906400
}
```

* `sub` (string, required): Unique UUID or string ID of the user.
* `email` (string, required): Normalized user email address.
* `role` (enum, required): `patient` | `provider` | `admin` | `super_admin` | `finance_admin` | `verifier`.
* `exp` (number, required): Expiration epoch seconds (default: 24 hours).

---

## 3. Session Expiry & Token Rotation
* On token expiration, the backend returns HTTP 401 with `errorCode: "UNAUTHORIZED"`.
* Clients invoke `POST /api/v1/auth/refresh` using the secure HTTP-only refresh cookie to obtain a fresh access token without user re-authentication.
