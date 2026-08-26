import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ComplaintEntity } from "../../database/entities/complaint.entity";

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectRepository(ComplaintEntity)
    private readonly complaintRepo: Repository<ComplaintEntity>,
  ) {}

  async getAllComplaints(): Promise<ComplaintEntity[]> {
    return this.complaintRepo.find();
  }

  async resolveComplaint(id: string): Promise<ComplaintEntity> {
    const complaint = await this.complaintRepo.findOne({ where: { id } });
    if (complaint) {
      complaint.status = "resolved";
      return this.complaintRepo.save(complaint);
    }
    return null;
  }
}
