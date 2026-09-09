import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity, CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { ServiceEntity } from "../../database/entities/service.entity";
import { RealtimeService } from "../realtime/realtime.service";
import * as crypto from "crypto";

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    @InjectRepository(AppointmentStatusHistoryEntity)
    private readonly historyRepo: Repository<AppointmentStatusHistoryEntity>,
    @InjectRepository(CancellationReasonEntity)
    private readonly cancellationRepo: Repository<CancellationReasonEntity>,
    private readonly dataSource: DataSource,
    private readonly realtimeService: RealtimeService,
  ) {}

  async getAllAppointments(limit = 50, offset = 0, patientId?: string): Promise<AppointmentEntity[]> {
    const where: any = {};
    if (patientId) {
      where.patientId = patientId;
    }
    return this.appointmentRepo.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      relations: ["patient", "provider", "serviceRelation"],
      take: limit,
      skip: offset,
      order: { date: "DESC" as any, time: "DESC" as any },
    });
  }

  async getAppointmentById(id: string): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({
      where: { id },
      relations: ["patient", "provider", "serviceRelation"]
    });
    if (!apt) throw new BadRequestException("Appointment not found");
    return apt;
  }

  // Finite State Machine Status Transition Validator
  isValidTransition(from: string, to: string): boolean {
    const transitions: Record<string, string[]> = {
      requested: ["searching", "cancelled", "expired"],
      searching: ["accepted", "scheduled", "cancelled", "expired"],
      accepted: ["scheduled", "on_the_way", "cancelled"],
      scheduled: ["on_the_way", "cancelled"],
      on_the_way: ["arrived", "cancelled"],
      arrived: ["in_progress", "cancelled"],
      in_progress: ["completed", "disputed"],
      completed: ["disputed"],
      cancelled: [],
      expired: [],
      disputed: ["completed", "cancelled"],
    };

    const allowed = transitions[from] || [];
    return allowed.includes(to);
  }

  // Atomic database transaction for bookings
  async createAppointment(data: any): Promise<AppointmentEntity> {
    const result = await this.dataSource.transaction(async (manager) => {
      // Prevent double booking if provider is pre-assigned
      if (data.providerId) {
        // Acquire pessimistic lock on provider row to serialize concurrent booking transactions
        try {
          await manager.findOne(ProviderEntity, {
            where: { id: data.providerId },
            lock: { mode: "pessimistic_write" },
          });
        } catch {
          // Fallback if underlying DB driver does not support row locks in test mode
        }

        const collision = await manager.findOne(AppointmentEntity, {
          where: {
            providerId: data.providerId,
            date: data.date,
            time: data.time,
            status: In(["requested", "scheduled", "accepted", "on_the_way", "arrived", "in_progress"]),
          },
        });
        if (collision) {
          throw new ConflictException("Provider is already booked for this date and time.");
        }
      }

      const apt = new AppointmentEntity();
      apt.id = "apt-" + crypto.randomUUID();

      apt.patientId = data.patientId || null;
      apt.providerId = data.providerId || null;
      apt.serviceId = data.serviceId || null;

      apt.patientName = data.patientName || "Patient";
      apt.patientAvatar = data.patientAvatar;
      apt.providerName = data.providerName;
      apt.providerAvatar = data.providerAvatar;
      apt.service = data.service || "Doctor Home Visit";
      apt.date = data.date;
      apt.time = data.time;
      apt.location = data.location;
      apt.amount = data.amount || 0;
      apt.status = data.status || "requested";

      const savedApt = await manager.save(apt);

      // Save initial status history record
      const history = new AppointmentStatusHistoryEntity();
      history.id = `apth-${crypto.randomUUID()}`;
      history.appointmentId = savedApt.id;
      history.status = savedApt.status;
      history.changedBy = data.patientId || "patient";
      history.notes = "Appointment request created.";
      history.createdAt = new Date().toISOString();
      await manager.save(history);

      return savedApt;
    });

    // Broadcast live update to all subscribed WebSocket clients (Admin portal + Provider dashboard)
    try {
      this.realtimeService.emitNewServiceRequest({
        appointmentId: result.id,
        patientName: result.patientName,
        service: result.service,
        status: result.status,
        date: result.date,
        time: result.time,
        location: result.location,
        amount: result.amount,
      });
      this.realtimeService.emitAppointmentUpdate(result.id, result.status, {
        appointmentId: result.id,
        patientName: result.patientName,
        service: result.service,
        status: result.status,
        date: result.date,
        time: result.time,
        location: result.location,
        amount: result.amount,
      });
    } catch (_) {}

    return result;
  }

  async updateStatus(
    id: string, 
    newStatus: string, 
    actorId: string, 
    visitNotes?: string, 
    disputeReason?: string
  ): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    if (!this.isValidTransition(apt.status, newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${apt.status} to ${newStatus}`);
    }

    apt.status = newStatus;
    if (visitNotes) apt.visitNotes = visitNotes;
    if (disputeReason) apt.disputeReason = disputeReason;

    const savedApt = await this.appointmentRepo.save(apt);

    // Save status history record
    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${crypto.randomUUID()}`;
    history.appointmentId = id;
    history.status = newStatus;
    history.changedBy = actorId;
    history.notes = visitNotes || disputeReason || `Status transitioned to ${newStatus}.`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    // Emit realtime status update to appointment room
    this.realtimeService.emitAppointmentUpdate(id, newStatus, {
      patientId: savedApt.patientId,
      providerId: savedApt.providerId,
      visitNotes,
    });

    return savedApt;
  }

  async cancelAppointment(id: string, reason: string, actorId: string): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    if (!this.isValidTransition(apt.status, "cancelled")) {
      throw new BadRequestException(`Cannot cancel appointment from state ${apt.status}`);
    }

    apt.status = "cancelled";
    apt.cancelledBy = actorId;
    apt.cancellationReason = reason;
    const savedApt = await this.appointmentRepo.save(apt);

    // Save cancellation reason record
    const cancelRecord = new CancellationReasonEntity();
    cancelRecord.id = `cxl-${crypto.randomUUID()}`;
    cancelRecord.appointmentId = id;
    cancelRecord.reason = reason;
    cancelRecord.cancelledBy = actorId;
    cancelRecord.notes = `Cancelled from status: ${apt.status}`;
    await this.cancellationRepo.save(cancelRecord);

    // Save status history
    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${crypto.randomUUID()}`;
    history.appointmentId = id;
    history.status = "cancelled";
    history.changedBy = actorId;
    history.notes = `Cancelled. Reason: ${reason}`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    // Broadcast live cancelled update to all connected admins & providers
    try {
      this.realtimeService.emitAppointmentUpdate(id, "cancelled", {
        appointmentId: id,
        patientName: savedApt.patientName,
        service: savedApt.service,
        status: "cancelled",
        date: savedApt.date,
        time: savedApt.time,
        location: savedApt.location,
        amount: savedApt.amount,
        cancelledBy: actorId,
        cancellationReason: reason,
      });
    } catch (_) {}

    return savedApt;
  }

  async rescheduleAppointment(id: string, newDate: string, newTime: string, actorId: string): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    // Prevent double booking on reschedule
    if (apt.providerId) {
      const collision = await this.appointmentRepo.findOne({
        where: {
          providerId: apt.providerId,
          date: newDate,
          time: newTime,
          status: In(["scheduled", "accepted", "on_the_way", "arrived", "in_progress"]),
        },
      });
      if (collision && collision.id !== id) {
        throw new ConflictException("Provider is already booked for this date and time.");
      }
    }

    const oldDetails = `Rescheduled from ${apt.date} ${apt.time} to ${newDate} ${newTime}`;
    apt.date = newDate;
    apt.time = newTime;
    const savedApt = await this.appointmentRepo.save(apt);

    // Save status history
    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${crypto.randomUUID()}`;
    history.appointmentId = id;
    history.status = apt.status;
    history.changedBy = actorId;
    history.notes = oldDetails;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    return savedApt;
  }

  async adminOverride(id: string, forceStatus: string, notes: string, actorId: string): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    // Bypass normal transition checks (Admin override / dispute resolution)
    const oldStatus = apt.status;
    apt.status = forceStatus;
    const savedApt = await this.appointmentRepo.save(apt);

    // Save status history
    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    history.appointmentId = id;
    history.status = forceStatus;
    history.changedBy = actorId;
    history.notes = `Admin override from ${oldStatus}. Notes: ${notes}`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    return savedApt;
  }

  // Provider Assignment / Reassignment
  async assignProvider(
    id: string,
    providerId: string,
    providerName: string,
    actorId: string,
  ): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    const collision = await this.appointmentRepo.findOne({
      where: {
        providerId,
        date: apt.date,
        time: apt.time,
        status: In(["scheduled", "accepted", "on_the_way", "arrived", "in_progress"]),
      },
    });
    if (collision && collision.id !== id) {
      throw new ConflictException("Provider is already booked for this appointment slot.");
    }

    apt.providerId = providerId;
    apt.providerName = providerName;
    apt.status = "accepted";
    const savedApt = await this.appointmentRepo.save(apt);

    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${crypto.randomUUID()}`;
    history.appointmentId = id;
    history.status = "accepted";
    history.changedBy = actorId;
    history.notes = `Assigned to provider ${providerName} (${providerId}).`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    try {
      this.realtimeService.emitAppointmentUpdate(id, "accepted", {
        appointmentId: id,
        providerId,
        providerName,
      });
    } catch (_) {}

    return savedApt;
  }

  // Provider Arrival Check-in
  async checkInProvider(id: string, actorId: string, coordinates?: { latitude: number; longitude: number }): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    apt.status = "arrived";
    const savedApt = await this.appointmentRepo.save(apt);

    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    history.appointmentId = id;
    history.status = "arrived";
    history.changedBy = actorId;
    history.notes = coordinates
      ? `Provider arrived at patient location (lat: ${coordinates.latitude}, lng: ${coordinates.longitude})`
      : "Provider arrived at patient location.";
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    return savedApt;
  }

  // Provider Visit Check-out and Clinical Summary
  async checkOutProvider(
    id: string,
    actorId: string,
    vitals?: any,
    prescriptions?: string[]
  ): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    apt.status = "completed";
    const savedApt = await this.appointmentRepo.save(apt);

    const summaryNotes = vitals
      ? `Visit completed. Clinical Summary: BP=${vitals.bloodPressure || "N/A"}, HR=${vitals.heartRate || "N/A"}. Prescriptions: ${(prescriptions || []).join(", ") || "None"}`
      : "Visit completed by provider.";

    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    history.appointmentId = id;
    history.status = "completed";
    history.changedBy = actorId;
    history.notes = summaryNotes;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    return savedApt;
  }

  // No-Show Detection & Escalation
  async markNoShow(id: string, party: "patient" | "provider", actorId: string, notes?: string): Promise<AppointmentEntity> {
    const apt = await this.appointmentRepo.findOne({ where: { id } });
    if (!apt) throw new BadRequestException("Appointment not found");

    apt.status = "cancelled";
    const savedApt = await this.appointmentRepo.save(apt);

    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    history.appointmentId = id;
    history.status = "cancelled";
    history.changedBy = actorId;
    history.notes = `No-show recorded for ${party}. Notes: ${notes || "No response after 15-minute wait."}`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

    return savedApt;
  }

  // Sweeper for requests matching timeout (1 hour request expiration)
  async expirePendingRequests(): Promise<number> {
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const pendingRequests = await this.appointmentRepo.find({
      where: {
        status: In(["requested", "searching"]),
      }
    });

    let expiredCount = 0;
    for (const req of pendingRequests) {
      if (req.createdAt && new Date(req.createdAt) < cutoffTime) {
        req.status = "expired";
        await this.appointmentRepo.save(req);

        const history = new AppointmentStatusHistoryEntity();
        history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        history.appointmentId = req.id;
        history.status = "expired";
        history.changedBy = "system";
        history.notes = "Request matching timeout reached.";
        history.createdAt = new Date().toISOString();
        await this.historyRepo.save(history);

        expiredCount++;
      }
    }
    return expiredCount;
  }
}
