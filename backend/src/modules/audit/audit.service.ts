import { Injectable } from "@nestjs/common";

@Injectable()
export class AuditService {
  getAuditLogs() {
    return [
      { id: "log001", actor: "Admin Kebede", action: "Provider verified", resource: "Dr. Meron Alemu", timestamp: "2026-08-25T09:10:00", status: "success" },
      { id: "log002", actor: "Admin Tigist", action: "User suspended", resource: "Bereket Mengistu", timestamp: "2026-08-25T08:45:00", status: "warning" },
      { id: "log003", actor: "System", action: "Payment processed", resource: "TXN-001", timestamp: "2026-08-25T08:00:00", status: "success" },
      { id: "log004", actor: "Admin Kebede", action: "Complaint resolved", resource: "CMP-003", timestamp: "2026-08-24T16:30:00", status: "success" },
      { id: "log005", actor: "Admin Tigist", action: "Service created", resource: "Elderly Care Premium", timestamp: "2026-08-24T14:00:00", status: "success" },
      { id: "log006", actor: "System", action: "Payment failed", resource: "TXN-008", timestamp: "2026-08-18T10:22:00", status: "error" },
    ];
  }
}
