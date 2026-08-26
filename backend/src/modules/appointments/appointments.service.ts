import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getAllAppointments(): Promise<AppointmentEntity[]> {
    return this.appointmentRepo.find();
  }

  // Atomic database transaction for bookings
  async createAppointment(data: any): Promise<AppointmentEntity> {
    return this.dataSource.transaction(async (manager) => {
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
      apt.amount = data.amount;
      apt.status = "pending";

      return manager.save(apt);
    });
  }
}
