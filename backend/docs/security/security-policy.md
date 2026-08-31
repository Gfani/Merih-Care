# Merihcare Platform Security Policy

## 1. Scope & Objective
This policy defines the security standards and operational requirements for the Merihcare Telemedicine & Healthcare Logistics Platform, ensuring full compliance with HIPAA, GDPR, and Ethiopian digital health regulations.

## 2. Authentication & Access Control
- **Password Standards**: Minimum 8 characters with at least one uppercase letter, one lowercase letter, one number, and one special symbol. Hashed with Bcrypt (12 salt rounds) or Argon2id.
- **Session Tokens**: JWT access tokens expire in 15 minutes. Refresh tokens expire in 7 days and are cryptographically rotated upon use.
- **Role-Based Access Control (RBAC)**: Enforced on all protected routes using `RolesGuard` (`patient`, `provider`, `admin`, `system`).
- **Privileged Actions**: Administrative actions require MFA (TOTP) and generate immutable audit logs.

## 3. Data Protection & Cryptography
- **Data in Transit**: Enforced TLS 1.3 with HSTS enabled on all edge endpoints.
- **Data at Rest**: Sensitive Protected Health Information (PHI)—including clinical diagnoses, notes, and medical attachments—is encrypted using AES-256-GCM.
- **Secrets Management**: No plaintext credentials in source control; production secrets are loaded via environment managers or KMS.

## 4. Input Sanitization & API Security
- **Global Validation**: `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` to prevent mass-assignment vulnerabilities.
- **SQL Injection Prevention**: All queries use TypeORM parameterized query builders and strongly typed entity repositories.
- **Webhook Integrity**: All payment gateway webhooks (Telebirr, CBE Birr, Chapa) are verified using HMAC SHA-256 signatures with replay protection timestamps.
