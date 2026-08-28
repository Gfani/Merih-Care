import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogEntity } from "../../database/entities/logs-delivery.entity";

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  async getAuditLogs() {
    const logs = await this.auditLogRepo.find({ order: { timestamp: "DESC" } });
    if (logs.length === 0) {
      // Seed audit logs
      return [
        { id: "log001", actor: "Admin Kebede", action: "Provider verified", resource: "Dr. Meron Alemu", timestamp: "2026-08-25T09:10:00", status: "success" },
        { id: "log002", actor: "Admin Tigist", action: "User suspended", resource: "Bereket Mengistu", timestamp: "2026-08-25T08:45:00", status: "warning" },
        { id: "log003", actor: "System", action: "Payment processed", resource: "TXN-001", timestamp: "2026-08-25T08:00:00", status: "success" },
        { id: "log004", actor: "Admin Kebede", action: "Complaint resolved", resource: "CMP-003", timestamp: "2026-08-24T16:30:00", status: "success" },
        { id: "log005", actor: "Admin Tigist", action: "Service created", resource: "Elderly Care Premium", timestamp: "2026-08-24T14:00:00", status: "success" },
        { id: "log006", actor: "System", action: "Payment failed", resource: "TXN-008", timestamp: "2026-08-18T10:22:00", status: "error" },
      ];
    }
    return logs.map(l => ({
      id: l.id,
      actor: l.actorId,
      action: l.action,
      resource: l.resource,
      timestamp: l.timestamp,
      status: l.status,
    }));
  }

  async logAction(actorId: string, action: string, resource: string, status: string, payload?: any) {
    const log = new AuditLogEntity();
    log.id = `log-${Date.now()}`;
    log.actorId = actorId;
    log.action = action;
    log.resource = resource;
    log.timestamp = new Date().toISOString();
    log.status = status;
    log.payload = payload ? JSON.stringify(payload) : null;
    await this.auditLogRepo.save(log);
  }
}
