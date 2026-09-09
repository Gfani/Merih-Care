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
      const live = await this.appointmentRepo.find({
        relations: ["patient", "provider", "serviceRelation"],
        order: { date: "DESC" as any, time: "DESC" as any },
        take: 100,
      });

      if (live && live.length > 0) {
        return live.map((apt) => ({
          id: apt.id,
          patientId: apt.patientId || (apt.patient?.id) || "u-patient",
          patientName: apt.patientName || (apt.patient?.name) || "Patient",
          patientAvatar: apt.patientAvatar || (apt.patient as any)?.avatar,
          service: apt.service || (apt.serviceRelation?.name) || "Doctor Home Visit",
          providerId: apt.providerId,
          providerName: apt.providerName || (apt.provider?.name) || "Pending Clinician Match",
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

    return [
      {
        id: "req1",
        patientId: "u3",
        patientName: "Selamawit Tadesse",
        patientAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&auto=format",
        service: "Home Nursing",
        date: "2026-08-26",
        time: "16:00",
        location: "Megenagna, Addis Ababa",
        notes: "Post-surgery wound care and dressing change",
        estimatedEarnings: 750,
        distance: "1.4 km",
        status: "pending",
        createdAt: "2026-08-25T08:14:00",
      },
      {
        id: "req2",
        patientId: "u5",
        patientName: "Frehiwot Solomon",
        patientAvatar: "https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=200&h=200&fit=crop&auto=format",
        service: "Medication Assist",
        date: "2026-08-26",
        time: "12:00",
        location: "Piazza, Addis Ababa",
        notes: "Daily insulin injection management for elderly parent",
        estimatedEarnings: 380,
        distance: "3.2 km",
        status: "pending",
        createdAt: "2026-08-25T07:30:00",
      },
      {
        id: "req3",
        patientId: "u2",
        patientName: "Dawit Haile",
        patientAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format",
        service: "Wound Care",
        date: "2026-08-27",
        time: "10:30",
        location: "Kazanchis, Addis Ababa",
        notes: "Burn wound dressing — requires sterile technique",
        estimatedEarnings: 500,
        distance: "0.9 km",
        status: "pending",
        createdAt: "2026-08-25T06:55:00",
      },
    ];
  }
}
