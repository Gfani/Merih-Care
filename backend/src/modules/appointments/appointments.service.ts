import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { AppointmentStatusHistoryEntity, CancellationReasonEntity } from "../../database/entities/appointment-history.entity";
import { RealtimeService } from "../realtime/realtime.service";

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

  async getAllAppointments(): Promise<AppointmentEntity[]> {
    return this.appointmentRepo.find({
      relations: ["patient", "provider", "serviceRelation"]
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
    return this.dataSource.transaction(async (manager) => {
      // Prevent double booking if provider is pre-assigned
      if (data.providerId) {
        const collision = await manager.findOne(AppointmentEntity, {
          where: {
            providerId: data.providerId,
            date: data.date,
            time: data.time,
            status: In(["scheduled", "accepted", "on_the_way", "arrived", "in_progress"]),
          },
        });
        if (collision) {
          throw new ConflictException("Provider is already booked for this date and time.");
        }
      }

      const apt = new AppointmentEntity();
      apt.id = "apt-" + Date.now();
      apt.patientId = data.patientId;
      apt.patientName = data.patientName;
      apt.patientAvatar = data.patientAvatar;
      apt.providerId = data.providerId;
      apt.providerName = data.providerName;
      apt.providerAvatar = data.providerAvatar;
      apt.serviceId = data.serviceId;
      apt.service = data.service;
      apt.date = data.date;
      apt.time = data.time;
      apt.location = data.location;
      apt.amount = data.amount || 0;
      apt.status = data.status || "requested";

      const savedApt = await manager.save(apt);

      // Save initial status history record
      const history = new AppointmentStatusHistoryEntity();
      history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      history.appointmentId = savedApt.id;
      history.status = savedApt.status;
      history.changedBy = data.patientId || "patient";
      history.notes = "Appointment request created.";
      history.createdAt = new Date().toISOString();
      await manager.save(history);

      return savedApt;
    });
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
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
    cancelRecord.id = `cxl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    cancelRecord.appointmentId = id;
    cancelRecord.reason = reason;
    cancelRecord.cancelledBy = actorId;
    cancelRecord.notes = `Cancelled from status: ${apt.status}`;
    await this.cancellationRepo.save(cancelRecord);

    // Save status history
    const history = new AppointmentStatusHistoryEntity();
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    history.appointmentId = id;
    history.status = "cancelled";
    history.changedBy = actorId;
    history.notes = `Cancelled. Reason: ${reason}`;
    history.createdAt = new Date().toISOString();
    await this.historyRepo.save(history);

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
    history.id = `apth-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
