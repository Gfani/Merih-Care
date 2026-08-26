import { Injectable } from "@nestjs/common";

@Injectable()
export class PayoutsService {
  async getPayouts(): Promise<any[]> {
    return [
      { id: "pay001", providerName: "Dr. Meron Alemu", amount: 3500, status: "completed", date: "2026-08-10" },
      { id: "pay002", providerName: "Hiwot Girma", amount: 2400, status: "completed", date: "2026-08-12" },
      { id: "pay003", providerName: "Yonas Tekeste", amount: 1500, status: "pending", date: "2026-08-25" },
    ];
  }
}
