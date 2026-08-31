import { Injectable, NotFoundException } from "@nestjs/common";
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

  async createComplaint(
    reporterId: string,
    reporterName: string,
    reporterRole: string,
    subject: string,
    priority: "low" | "medium" | "high" | "critical",
    description: string
  ): Promise<ComplaintEntity> {
    const complaint = new ComplaintEntity();
    complaint.id = `comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    complaint.reporterId = reporterId;
    complaint.reporterName = reporterName;
    complaint.reporterRole = reporterRole;
    complaint.subject = subject;
    complaint.priority = priority;
    complaint.description = description;
    complaint.status = "pending";
    complaint.date = new Date().toISOString().split("T")[0];
    complaint.createdAt = new Date();
    complaint.updatedAt = new Date();
    return this.complaintRepo.save(complaint);
  }

  async assignInvestigator(id: string, investigatorId: string, actorId: string): Promise<ComplaintEntity> {
    const complaint = await this.complaintRepo.findOne({ where: { id } });
    if (!complaint) throw new NotFoundException("Complaint not found");

    complaint.status = "investigating";
    complaint.updatedAt = new Date();
    return this.complaintRepo.save(complaint);
  }

  async respondToComplaint(
    id: string,
    responseText: string,
    newStatus: "investigating" | "resolved",
    actorId: string
  ): Promise<ComplaintEntity> {
    const complaint = await this.complaintRepo.findOne({ where: { id } });
    if (!complaint) throw new NotFoundException("Complaint not found");

    complaint.status = newStatus;
    complaint.description = `${complaint.description}\n\n[Official Response by ${actorId}]: ${responseText}`;
    complaint.updatedAt = new Date();
    return this.complaintRepo.save(complaint);
  }

  async escalateComplaint(id: string, reason: string, actorId: string): Promise<any> {
    const complaint = await this.complaintRepo.findOne({ where: { id } });
    if (!complaint) throw new NotFoundException("Complaint not found");

    complaint.priority = "critical";
    complaint.status = "investigating";
    complaint.description = `${complaint.description}\n\n[ESCALATED by ${actorId}]: ${reason}`;
    complaint.updatedAt = new Date();
    await this.complaintRepo.save(complaint);

    return { success: true, complaintId: id, escalatedPriority: "critical", reason };
  }

  async resolveComplaint(id: string): Promise<ComplaintEntity> {
    const complaint = await this.complaintRepo.findOne({ where: { id } });
    if (complaint) {
      complaint.status = "resolved";
      complaint.updatedAt = new Date();
      return this.complaintRepo.save(complaint);
    }
    return null;
  }
}
