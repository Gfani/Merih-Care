import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo: Repository<AppointmentEntity>,
  ) {}

  async getAllAppointments(): Promise<AppointmentEntity[]> {
    return this.appointmentRepo.find();
  }
}
