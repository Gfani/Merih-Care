import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEarningsEntity, PayoutEntity } from "../../database/entities/financial.entity";

@Injectable()
export class ProviderEarningsService {
  constructor(
    @InjectRepository(ProviderEarningsEntity)
    private readonly earningsRepo: Repository<ProviderEarningsEntity>,
    @InjectRepository(PayoutEntity)
    private readonly payoutRepo: Repository<PayoutEntity>,
  ) {}

  async getEarnings(providerId: string): Promise<any> {
    let ledger = await this.earningsRepo.findOne({ where: { providerId } });
    if (!ledger) {
      ledger = new ProviderEarningsEntity();
      ledger.providerId = providerId;
      ledger.balance = 0;
      ledger.totalEarned = 0;
      ledger.totalWithdrawn = 0;
    }

    const pendingPayoutsList = await this.payoutRepo.find({
      where: { providerId, status: "pending" }
    });

    const payoutsPendingAmount = pendingPayoutsList.reduce((sum, p) => sum + p.amount, 0);

    const history = await this.payoutRepo.find({
      where: { providerId }
    });

    return {
      providerId,
      totalEarnings: ledger.totalEarned,
      payoutsPending: payoutsPendingAmount,
      balance: ledger.balance,
      history: history.map(p => ({
        id: p.id,
        date: p.createdAt ? p.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
        amount: p.amount,
        status: p.status,
        description: `Payout withdrawal request (${p.status})`
      }))
    };
  }

  async exportEarningsCsv(providerId: string): Promise<string> {
    const data = await this.getEarnings(providerId);
    let csv = "Transaction ID,Date,Amount (ETB),Status,Description\n";
    for (const h of data.history) {
      csv += `"${h.id}","${h.date}",${h.amount},"${h.status}","${h.description}"\n`;
    }
    csv += `\n"Summary Total Earned",,${data.totalEarnings},,\n`;
    csv += `"Summary Available Balance",,${data.balance},,\n`;
    csv += `"Summary Pending Payouts",,${data.payoutsPending},,\n`;
    return csv;
  }
}
