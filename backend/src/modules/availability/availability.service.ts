import { Injectable } from "@nestjs/common";

@Injectable()
export class AvailabilityService {
  async getAvailability(providerId: string): Promise<any> {
    return {
      providerId,
      timeSlots: [
        { id: "slot1", date: "2026-08-26", time: "09:00 - 10:00", available: true },
        { id: "slot2", date: "2026-08-26", time: "10:00 - 11:00", available: false },
        { id: "slot3", date: "2026-08-26", time: "14:00 - 15:00", available: true },
      ]
    };
  }
}
