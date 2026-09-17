import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

@Injectable()
export class ServiceRequestsService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
  ) {}

  async getServiceRequests() {
    try {
      const qb = this.appointmentRepo
        .createQueryBuilder("apt")
        .leftJoinAndSelect("apt.patient", "patient")
        .leftJoinAndSelect("apt.provider", "provider")
        .leftJoinAndSelect("apt.serviceRelation", "serviceRelation")
        .orderBy("apt.createdAt", "DESC")
        .take(100);

      const live = await qb.getMany();

      if (live && live.length > 0) {
        return live.map((apt) => ({
          id: apt.id,
          patientId: apt.patientId || apt.patient?.id || "u-patient",
          patientName: apt.patientName || apt.patient?.name || "Patient",
          patientAvatar: apt.patientAvatar || (apt.patient as any)?.avatar,
          patientPhone: apt.patientPhone || apt.patient?.phone || "",
          service: apt.service || apt.serviceRelation?.name || "Doctor Home Visit",
          providerId: apt.providerId,
          providerName: apt.providerName || apt.provider?.name || "Pending Clinician Match",
          providerPhone: apt.providerPhone || apt.provider?.phone || "",
          date: apt.date,
          time: apt.time,
          location: apt.location || "Addis Ababa",
          notes: apt.visitNotes || "",
          estimatedEarnings: apt.amount || 750,
          amount: apt.amount || 0,
          status: apt.status || "requested",
          createdAt: apt.createdAt || new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.error("[REQUESTS] Error querying real appointments from DB:", e);
    }

    // Clean state: return empty list, zero demo users
    return [];
  }
}
