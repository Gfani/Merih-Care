# Merihcare Dependency Patching & Vulnerability Management SLA

## 1. Vulnerability Remediation SLAs
- **Critical (CVSS 9.0 - 10.0)**: Patch deployed within **24 hours** of advisory.
- **High (CVSS 7.0 - 8.9)**: Patch deployed within **7 days**.
- **Medium (CVSS 4.0 - 6.9)**: Patch deployed within **30 days** in the regular sprint cycle.
- **Low (CVSS 0.1 - 3.9)**: Evaluated and patched during scheduled quarterly maintenance.

## 2. Emergency Zero-Day Patching Workflow
1. Security lead validates affected dependency and triggers an emergency hotfix branch.
2. The patched package is built, audited via automated test suites (`npm test`), and validated in staging.
3. Automated deployment triggers blue-green production update.
