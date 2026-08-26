import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { PayoutEntity } from "../../database/entities/financial.entity";

@Injectable()
export class PayoutsService {
  constructor(private readonly dataSource: DataSource) {}

  async getPayouts(): Promise<any[]> {
    return [
      { id: "pay001", providerName: "Dr. Meron Alemu", amount: 3500, status: "completed", date: "2026-08-10" },
      { id: "pay002", providerName: "Hiwot Girma", amount: 2400, status: "completed", date: "2026-08-12" },
      { id: "pay003", providerName: "Yonas Tekeste", amount: 1500, status: "pending", date: "2026-08-25" },
    ];
  }

  // Atomic database transaction for payouts
  async createPayout(providerId: string, amount: number, bankAccount: string): Promise<PayoutEntity> {
    return this.dataSource.transaction(async (manager) => {
      const payout = new PayoutEntity();
      payout.id = "pay-" + Date.now();
      payout.providerId = providerId;
      payout.amount = amount;
      payout.status = "pending";
      payout.bankAccount = bankAccount;
      payout.transactionReference = "REF-" + Date.now();
      payout.createdAt = new Date().toISOString();

      return manager.save(payout);
    });
  }
}
