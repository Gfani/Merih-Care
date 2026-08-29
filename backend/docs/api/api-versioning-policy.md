# Merihcare API Versioning Policy

## 1. Overview
The Merihcare backend API follows semantic API versioning with explicit URI path prefixes. All official public and client endpoints are served under `/api/v1/`.

---

## 2. Versioning Strategy
* **URI Path Versioning**: `/api/v1/{resource}`
* **Breaking Changes**: Any breaking modification (e.g. removing fields, renaming fields, altering response wrappers) requires bumping the major URI version to `/api/v2/`.
* **Non-Breaking Changes**: Adding new optional query parameters, extending response DTO fields, or introducing new endpoints are deployed under the existing `/api/v1/` contract without requiring version bumps.

---

## 3. Deprecation Schedule & Sunset Notice
* When an API version is designated as deprecated:
  * A `Deprecation: true` and `Sunset: <HTTP-Date>` header is attached to all outbound responses.
  * A minimum **180-day grace period** is guaranteed before an older API version is removed.
  * Active partners and mobile clients receive automated alerts via the Admin Web notification dispatch center.
