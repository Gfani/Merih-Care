import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { EmergencyEntity } from "../../database/entities/emergency.entity";
import {
  EmergencyResponderEntity,
  EmergencyEscalationHistoryEntity,
} from "../../database/entities/emergency-relation.entity";
import { RealtimeService } from "../realtime/realtime.service";
import * as crypto from "crypto";

@Injectable()
export class EmergencyService {
  constructor(
    @InjectRepository(EmergencyEntity)
    private readonly emergencyRepo: Repository<EmergencyEntity>,
    @InjectRepository(EmergencyResponderEntity)
    private readonly responderRepo: Repository<EmergencyResponderEntity>,
    @InjectRepository(EmergencyEscalationHistoryEntity)
    private readonly escalationRepo: Repository<EmergencyEscalationHistoryEntity>,
    private readonly dataSource: DataSource,
    private readonly realtimeService: RealtimeService,
  ) {}

  async getAllEmergencies(): Promise<EmergencyEntity[]> {
    return this.emergencyRepo.find();
  }

  async createEmergency(
    patientId: string,
    location: string,
    phone: string,
    type: "critical" | "moderate" | "minor",
    patientName?: string,
    emergencyContact?: string
  ): Promise<EmergencyEntity> {
    const alert = new EmergencyEntity();
    alert.id = `emg-${crypto.randomUUID()}`;
    alert.patientId = patientId;
    alert.patient = patientName || "Patient";
    alert.location = location;
    alert.phone = phone;
    alert.time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    alert.type = type.charAt(0).toUpperCase() + type.slice(1);
    alert.status = "active";
    alert.createdAt = new Date();
    alert.updatedAt = new Date();

    const saved = await this.emergencyRepo.save(alert);

    // Broadcast instant alert across realtime rooms
    this.realtimeService.emitEmergencyAlert(saved.id, {
      emergencyId: saved.id,
      severity: alert.type,
      location: alert.location,
      phone: alert.phone,
      patientName: alert.patient,
      emergencyContact,
      status: "active",
      ts: new Date().toISOString(),
    });

    return saved;
  }

  // Atomic database transactions for emergency dispatches
  async dispatchEmergency(id: string, responder: string): Promise<EmergencyEntity> {
    return this.dataSource.transaction(async (manager) => {
      const alert = await manager.findOne(EmergencyEntity, { where: { id } });
      if (!alert) throw new NotFoundException("Emergency case not found");

      alert.status = "dispatched";
      alert.responder = responder;
      alert.updatedAt = new Date();
      const savedAlert = await manager.save(alert);

      const dispatchLog = new EmergencyResponderEntity();
      dispatchLog.id = "log-" + crypto.randomUUID();
      dispatchLog.emergencyId = id;
      dispatchLog.providerId = responder;
      dispatchLog.dispatchedAt = new Date().toISOString();
      await manager.save(dispatchLog);

      // Broadcast emergency alert to emergency room and admin
      this.realtimeService.emitEmergencyAlert(id, {
        emergencyId: id,
        status: "dispatched",
        responder,
        dispatchedAt: dispatchLog.dispatchedAt,
      });

      return savedAlert;
    });
  }

  async reassignResponder(
    id: string,
    newResponder: string,
    actorId: string,
    reason?: string
  ): Promise<EmergencyEntity> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException("Emergency case not found");

    const oldResponder = alert.responder;
    alert.responder = newResponder;
    alert.updatedAt = new Date();
    const saved = await this.emergencyRepo.save(alert);

    // Log escalation / handoff record
    const escalation = new EmergencyEscalationHistoryEntity();
    escalation.id = `esc-${crypto.randomUUID()}`;
    escalation.emergencyId = id;
    escalation.level = "REASSIGNED";
    escalation.reason = reason || `Reassigned from ${oldResponder} to ${newResponder}`;
    escalation.escalatedBy = actorId;
    escalation.createdAt = new Date().toISOString();
    await this.escalationRepo.save(escalation);

    return saved;
  }

  async markResponderArrived(id: string, actorId: string): Promise<EmergencyEntity> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException("Emergency case not found");

    alert.status = "in_progress";
    alert.updatedAt = new Date();
    const saved = await this.emergencyRepo.save(alert);

    // Update responder arrival timestamp
    const dispatchLog = await this.responderRepo.findOne({
      where: { emergencyId: id },
      order: { dispatchedAt: "DESC" as any },
    });
    if (dispatchLog) {
      dispatchLog.arrivedAt = new Date().toISOString();
      await this.responderRepo.save(dispatchLog);
    }

    return saved;
  }

  async resolveEmergency(
    id: string,
    actorId: string,
    clinicalSummary?: string
  ): Promise<EmergencyEntity> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException("Emergency case not found");

    alert.status = "resolved";
    alert.updatedAt = new Date();
    const saved = await this.emergencyRepo.save(alert);

    // Broadcast resolution
    this.realtimeService.emitToRoom(`emergency:${id}`, "emergency_resolved", {
      emergencyId: id,
      resolvedBy: actorId,
      summary: clinicalSummary || "Emergency resolved by responder team.",
      resolvedAt: new Date().toISOString(),
    });

    return saved;
  }

  async escalateEmergency(id: string, actorId: string, reason: string): Promise<any> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException("Emergency case not found");

    const escalation = new EmergencyEscalationHistoryEntity();
    escalation.id = `esc-${crypto.randomUUID()}`;
    escalation.emergencyId = id;
    escalation.level = "LEVEL_2_PARAMEDIC_ESCALATION";
    escalation.reason = reason;
    escalation.escalatedBy = actorId;
    escalation.createdAt = new Date().toISOString();
    await this.escalationRepo.save(escalation);

    this.realtimeService.emitEmergencyAlert(id, {
      emergencyId: id,
      escalationLevel: escalation.level,
      reason,
      escalatedBy: actorId,
      ts: escalation.createdAt,
    });

    return { success: true, escalationId: escalation.id, level: escalation.level };
  }

  async rejectEmergency(id: string, providerId: string, reason?: string): Promise<any> {
    const alert = await this.emergencyRepo.findOne({ where: { id } });
    if (!alert) throw new NotFoundException("Emergency case not found");

    const escalation = new EmergencyEscalationHistoryEntity();
    escalation.id = `esc-${crypto.randomUUID()}`;
    escalation.emergencyId = id;
    escalation.level = "PROVIDER_REJECTED";
    escalation.reason = reason || `Provider ${providerId} rejected dispatch`;
    escalation.escalatedBy = providerId;
    escalation.createdAt = new Date().toISOString();
    await this.escalationRepo.save(escalation);

    // Re-broadcast alert to available providers
    this.realtimeService.emitToRoom("providers", "emergency_alert", {
      emergencyId: id,
      severity: alert.type,
      location: alert.location,
      status: "active",
      note: "Previous responder unavailable — re-broadcasting",
      ts: new Date().toISOString(),
    });

    return { success: true, reBroadcast: true };
  }
}
