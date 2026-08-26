import { Injectable } from "@nestjs/common";

@Injectable()
export class ProviderEarningsService {
  async getEarnings(providerId: string): Promise<any> {
    return {
      providerId,
      totalEarnings: 8400,
      payoutsPending: 1200,
      history: [
        { id: "e1", date: "2026-08-25", amount: 1020, description: "Doctor Home Visit Commission Net" },
        { id: "e2", date: "2026-08-20", amount: 510, description: "Physiotherapy Commission Net" },
      ]
    };
  }
}
