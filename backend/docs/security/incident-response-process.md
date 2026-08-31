# Merihcare Incident Response Plan & Breach Protocol

## 1. Incident Lifecycle Overview
1. **Identification**: Automated anomaly alerts (Sentry, audit log monitoring, rate-limit threshold spikes) or user-submitted security reports.
2. **Triage & Classification**:
   - **Sev 1 (Critical)**: Active breach of unencrypted PHI, compromised root admin account, or payment system tampering. (Response SLA: < 15 minutes)
   - **Sev 2 (High)**: Denial of service affecting emergency dispatch or provider location telemetry. (Response SLA: < 1 hour)
   - **Sev 3 (Medium)**: Disclosed low-risk vulnerability or localized single-account abuse. (Response SLA: < 4 hours)
3. **Containment**:
   - Revoke compromised JWT tokens and rotate master keys.
   - Block malicious IP subnets at the Nginx edge firewall.
   - Isolate affected container workloads.
4. **Eradication & Recovery**:
   - Apply vulnerability hotfix, verify schema integrity, and restore from trusted backup snapshot if necessary.
5. **Notification & Post-Mortem**:
   - Formal disclosure to regulatory bodies and affected patients within 72 hours of verified PHI exposure.
   - Comprehensive Root Cause Analysis (RCA) published within 5 business days.
