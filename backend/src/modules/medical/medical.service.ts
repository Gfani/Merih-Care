import { Injectable } from "@nestjs/common";

@Injectable()
export class MedicalRecordsService {
  async getRecords(patientId: string): Promise<any[]> {
    return [
      { id: "rec1", date: "2026-08-20", diagnosis: "Hypertension follow-up", notes: "Blood pressure stabilized at 125/80 mmHg." },
      { id: "rec2", date: "2026-08-10", diagnosis: "Post-surgery recovery", notes: "Sutures healing cleanly, no signs of inflammation." },
    ];
  }
}
