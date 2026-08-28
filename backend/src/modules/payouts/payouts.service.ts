import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { PayoutEntity, ProviderEarningsEntity } from "../../database/entities/financial.entity";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(PayoutEntity)
    private readonly payoutRepo: Repository<PayoutEntity>,
    @InjectRepository(ProviderEarningsEntity)
    private readonly earningsRepo: Repository<ProviderEarningsEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getPayouts(): Promise<PayoutEntity[]> {
    return this.payoutRepo.find();
  }

  getMinPayoutLimit(): number {
    const settingsPath = path.join(process.cwd(), "database", "settings.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        return parseFloat(settings.minPayout) || 500;
      } catch {
        // fallback
      }
    }
    return 500;
  }

  // Atomic database transaction for payouts
  async createPayout(providerId: string, amount: number, bankAccount: string): Promise<PayoutEntity> {
    return this.dataSource.transaction(async (manager) => {
      const minPayout = this.getMinPayoutLimit();
      if (amount < minPayout) {
        throw new BadRequestException(`Minimum payout limit is ${minPayout} ETB`);
      }

      // Check balance
      const ledger = await manager.findOne(ProviderEarningsEntity, { where: { providerId } });
      if (!ledger || ledger.balance < amount) {
        throw new BadRequestException("Insufficient ledger balance to request payout");
      }

      // Deduct balance
      ledger.balance -= amount;
      ledger.totalWithdrawn += amount;
      ledger.updatedAt = new Date().toISOString();
      await manager.save(ledger);

      const payout = new PayoutEntity();
      payout.id = "pay-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
      payout.providerId = providerId;
      payout.amount = amount;
      payout.status = "pending";
      payout.bankAccount = bankAccount;
      payout.transactionReference = "REF-" + Date.now();
      payout.createdAt = new Date().toISOString();

      return manager.save(payout);
    });
  }

  async updatePayoutStatus(id: string, newStatus: string, transactionReference?: string): Promise<PayoutEntity> {
    return this.dataSource.transaction(async (manager) => {
      const payout = await manager.findOne(PayoutEntity, { where: { id } });
      if (!payout) throw new BadRequestException("Payout request not found");

      if (payout.status !== "pending") {
        throw new BadRequestException("Payout request has already been processed");
      }

      if (newStatus === "completed") {
        payout.status = "completed";
        if (transactionReference) payout.transactionReference = transactionReference;
        return manager.save(payout);
      } 
      
      if (newStatus === "failed") {
        payout.status = "failed";
        
        // Refund amount back to provider ledger
        const ledger = await manager.findOne(ProviderEarningsEntity, { where: { providerId: payout.providerId } });
        if (ledger) {
          ledger.balance += payout.amount;
          ledger.totalWithdrawn = Math.max(0, ledger.totalWithdrawn - payout.amount);
          ledger.updatedAt = new Date().toISOString();
          await manager.save(ledger);
        }
        
        return manager.save(payout);
      }

      throw new BadRequestException(`Invalid payout status: ${newStatus}`);
    });
  }
}
