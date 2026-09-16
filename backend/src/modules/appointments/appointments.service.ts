import { Injectable, BadRequestException, ConflictException, Optional, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity, CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { UserEntity } from "../../database/entities/user.entity";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { ServiceEntity } from "../../database/entities/service.entity";
import { RealtimeService } from "../realtime/realtime.service";
import { NotificationsService } from "../notifications/notifications.service";
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
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  async getAllAppointments(limit = 50, offset = 0, patientId?: string, caller?: any): Promise<AppointmentEntity[]> {
    let apts: AppointmentEntity[] = [];

    // Role-aware filtering
    const isProvider = caller?.role === "provider";
    const isPatient = caller?.role === "patient";

    if (isProvider) {
      let provId = caller?.providerId;
      if (!provId && this.dataSource) {
        try {
          const provRepo = this.dataSource.getRepository(ProviderEntity);
          const prov = await provRepo.findOne({ where: { userId: caller.id || caller.sub } });
          if (prov) provId = prov.id;
        } catch (_) {}
      }

      // Providers see:
      // 1. Unassigned incoming requests searching for clinician (status IN ('requested', 'searching', 'pending'))
      // 2. Appointments assigned to this provider
      const qb = this.appointmentRepo
        .createQueryBuilder("apt")
        .leftJoinAndSelect("apt.patient", "patient")
        .leftJoinAndSelect("apt.provider", "provider")
        .leftJoinAndSelect("provider.user", "providerUser")
        .leftJoinAndSelect("apt.serviceRelation", "serviceRelation");

      if (provId) {
        qb.where(
          "(apt.providerId = :provId OR provider.userId = :userId) OR (apt.providerId IS NULL AND apt.status IN (:...pendingStatuses))",
          {
            provId,
            userId: caller.id || caller.sub,
            pendingStatuses: ["requested", "searching", "pending"],
          }
        );
      } else {
        qb.where(
          "(provider.userId = :userId) OR (apt.providerId IS NULL AND apt.status IN (:...pendingStatuses))",
          {
            userId: caller.id || caller.sub,
            pendingStatuses: ["requested", "searching", "pending"],
          }
        );
      }

      apts = await qb
        .orderBy("apt.createdAt", "DESC")
        .take(limit)
        .skip(offset)
        .getMany();
    } else {
      const where: any = {};
      if (patientId) {
        where.patientId = patientId;
      } else if (isPatient && (caller?.id || caller?.sub)) {
        where.patientId = caller.id || caller.sub;
      }

      apts = await this.appointmentRepo.find({
        where: Object.keys(where).length > 0 ? where : undefined,
        relations: ["patient", "provider", "provider.user", "serviceRelation"],
        take: limit,
        skip: offset,
        order: { date: "DESC" as any, time: "DESC" as any },
      });
    }

    for (const apt of apts) {
      if (!apt.providerPhone) {
        let phone = apt.provider?.phone || apt.provider?.user?.phone || "";
        if (!phone && (apt.providerId || apt.providerName)) {
          try {
            const provRepo = this.dataSource.getRepository(ProviderEntity);
            const p = apt.providerId
              ? await provRepo.findOne({ where: { id: apt.providerId }, relations: ["user"] })
              : await provRepo.findOne({ where: { name: apt.providerName }, relations: ["user"] });
            if (p) {
              phone = p.phone || p.user?.phone || "";
            }
          } catch (_) {}
        }
        apt.providerPhone = phone;
      }
      if (!apt.patientPhone && apt.patient?.phone) {
        apt.patientPhone = apt.patient.phone;
      }
    }
    return apts;
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
      apt.providerPhone = data.providerPhone || null;
      apt.patientPhone = data.patientPhone || null;

      if (!apt.providerPhone && (data.providerId || data.providerName)) {
        try {
          const prov = data.providerId
            ? await manager.findOne(ProviderEntity, { where: { id: data.providerId }, relations: ["user"] })
            : await manager.findOne(ProviderEntity, { where: { name: data.providerName }, relations: ["user"] });
          if (prov?.phone || prov?.user?.phone) {
            apt.providerPhone = prov.phone || prov.user.phone;
          }
        } catch (_) {}
      }
      if (!apt.patientPhone && data.patientId) {
        try {
          const pat = await manager.findOne(UserEntity, { where: { id: data.patientId } });
          if (pat?.phone) {
            apt.patientPhone = pat.phone;
          }
        } catch (_) {}
      }

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
      const eventPayload = {
        id: result.id,
        appointmentId: result.id,
        patientId: result.patientId,
        patientName: result.patientName,
        patientPhone: result.patientPhone,
        providerId: result.providerId,
        providerName: result.providerName,
        providerPhone: result.providerPhone,
        service: result.service,
        status: result.status,
        date: result.date,
        time: result.time,
        location: result.location,
        amount: result.amount,
        createdAt: result.createdAt,
      };

      // 1. Real-time broadcast to rooms: providers, admin, and global
      this.realtimeService.emitNewServiceRequest(eventPayload);
      this.realtimeService.emitAppointmentUpdate(result.id, result.status, eventPayload);
      this.realtimeService.emitToRoom("admin", "new_service_request", eventPayload);
      this.realtimeService.emitToRoom("admin", "appointment_status_update", eventPayload);

      // 2. Persist notification and notify all Platform Administrators
      try {
        const userRepo = this.dataSource.getRepository(UserEntity);
        const admins = await userRepo
          .createQueryBuilder("u")
          .where("u.role LIKE :adm OR u.adminRole IS NOT NULL", { adm: "%admin%" })
          .getMany();

        for (const admin of admins) {
          this.realtimeService.emitToRoom(`admin:${admin.id}`, "new_service_request", eventPayload);
          if (this.notificationsService) {
            this.notificationsService.sendNotification(admin.id, {
              type: "appointment_update",
              title: "New Service Request",
              body: `${result.patientName} requested ${result.service} (${result.location || "Addis Ababa"}).`,
              priority: "critical",
              data: {
                appointmentId: result.id,
                type: "service_request",
                patientName: result.patientName,
                service: result.service,
                location: result.location,
                amount: result.amount,
              },
            }).catch(() => {});
          }
        }
      } catch (_) {}

      // 3. Notify Providers
      try {
        const provRepo = this.dataSource.getRepository(ProviderEntity);

        if (result.providerId) {
          // Direct booking for a specific provider
          const prov = await provRepo.findOne({ where: { id: result.providerId }, relations: ["user"] });
          const provUserId = prov?.userId || prov?.user?.id || result.providerId;

          this.realtimeService.emitToRoom(`provider:${result.providerId}`, "new_service_request", eventPayload);
          if (prov?.userId) {
            this.realtimeService.emitToRoom(`provider:${prov.userId}`, "new_service_request", eventPayload);
          }

          if (this.notificationsService && provUserId) {
            this.notificationsService.sendNotification(provUserId, {
              type: "appointment_update",
              title: "New Patient Care Request",
              body: `${result.patientName} requested ${result.service} on ${result.date} at ${result.time}.`,
              priority: "critical",
              data: {
                appointmentId: result.id,
                type: "appointment_request",
                patientName: result.patientName,
                service: result.service,
                location: result.location,
                amount: result.amount,
              },
            }).catch(() => {});
          }
        } else {
          // On-demand request: dispatch to all nearby/active/verified providers
          const activeProviders = await provRepo
            .createQueryBuilder("prov")
            .leftJoinAndSelect("prov.user", "user")
            .where("prov.status IN (:...statuses) OR prov.available = :avail", {
              statuses: ["verified", "active"],
              avail: true,
            })
            .getMany();

          const notifiedUserIds = new Set<string>();
          for (const prov of activeProviders) {
            const targetUserId = prov.userId || prov.user?.id;
            if (!targetUserId || notifiedUserIds.has(targetUserId)) continue;
            notifiedUserIds.add(targetUserId);

            this.realtimeService.emitToRoom(`provider:${targetUserId}`, "new_service_request", eventPayload);
            this.realtimeService.emitToRoom(`provider:${prov.id}`, "new_service_request", eventPayload);

            if (this.notificationsService) {
              this.notificationsService.sendNotification(targetUserId, {
                type: "appointment_update",
                title: "New Care Request Nearby",
                body: `${result.patientName} requested ${result.service} near ${result.location || "your area"}. Tap to review and accept.`,
                priority: "critical",
                data: {
                  appointmentId: result.id,
                  type: "appointment_request",
                  patientName: result.patientName,
                  service: result.service,
                  location: result.location,
                  amount: result.amount,
                },
              }).catch(() => {});
            }
          }
        }
      } catch (_) {}
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

    // Auto-assign accepting clinician if appointment was unassigned
    if (newStatus === "accepted" && !apt.providerId && actorId && actorId !== "unknown" && actorId !== "patient") {
      try {
        const provRepo = this.dataSource.getRepository(ProviderEntity);
        const prov = await provRepo.findOne({
          where: [{ id: actorId }, { userId: actorId }],
          relations: ["user"],
        });
        if (prov) {
          apt.providerId = prov.id;
          apt.providerName = prov.name;
          apt.providerPhone = prov.phone || prov.user?.phone || apt.providerPhone;
          apt.providerAvatar = prov.avatar || apt.providerAvatar;
        }
      } catch (_) {}
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

    // Emit realtime status update to appointment room & admin portal
    this.realtimeService.emitAppointmentUpdate(id, newStatus, {
      appointmentId: id,
      patientId: savedApt.patientId,
      providerId: savedApt.providerId,
      providerName: savedApt.providerName,
      providerPhone: savedApt.providerPhone,
      status: newStatus,
      visitNotes,
    });

    // Notify patient in real-time
    if (savedApt.patientId && typeof this.realtimeService?.emitProviderResponse === "function") {
      this.realtimeService.emitProviderResponse(savedApt.patientId, {
        appointmentId: id,
        status: newStatus,
        providerId: savedApt.providerId,
        providerName: savedApt.providerName,
        providerPhone: savedApt.providerPhone,
        providerAvatar: savedApt.providerAvatar,
      });

      if (newStatus === "accepted" && this.notificationsService) {
        this.notificationsService.sendNotification(savedApt.patientId, {
          type: "appointment_update",
          title: "Care Request Accepted! 🩺",
          body: `${savedApt.providerName || "Your clinician"} has accepted your ${savedApt.service} request and is on the way.`,
          priority: "critical",
          data: {
            appointmentId: id,
            status: "accepted",
            providerId: savedApt.providerId,
            providerName: savedApt.providerName,
            providerPhone: savedApt.providerPhone,
          },
        }).catch(() => {});
      }
    }

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
