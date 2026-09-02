import { Injectable, BadRequestException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { PayoutEntity, ProviderEarningsEntity, PayoutBatchEntity } from "../../database/entities/financial.entity";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(PayoutEntity)
    private readonly payoutRepo: Repository<PayoutEntity>,
    @InjectRepository(ProviderEarningsEntity)
    private readonly earningsRepo: Repository<ProviderEarningsEntity>,
    private readonly dataSource: DataSource,
    @Optional()
    @InjectRepository(PayoutBatchEntity)
    private readonly batchRepo?: Repository<PayoutBatchEntity>,
  ) {}

  async getPayouts(): Promise<PayoutEntity[]> {
    return this.payoutRepo.find();
  }

  private cachedMinPayout: { limit: number; expiresAt: number } | null = null;

  getMinPayoutLimit(): number {
    const now = Date.now();
    if (this.cachedMinPayout && this.cachedMinPayout.expiresAt > now) {
      return this.cachedMinPayout.limit;
    }

    let limit = 500;
    const settingsPath = path.join(process.cwd(), "database", "settings.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        limit = parseFloat(settings.minPayout) || 500;
      } catch {
        limit = 500;
      }
    }
    this.cachedMinPayout = { limit, expiresAt: now + 60000 };
    return limit;
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
      ledger.updatedAt = new Date();
      await manager.save(ledger);

      const payout = new PayoutEntity();
      payout.id = "pay-" + crypto.randomUUID();
      payout.providerId = providerId;
      payout.amount = amount;
      payout.status = "pending";
      payout.bankAccount = bankAccount;
      payout.transactionReference = "REF-" + crypto.randomUUID();
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
          ledger.updatedAt = new Date();
          await manager.save(ledger);
        }
        
        return manager.save(payout);
      }

      throw new BadRequestException(`Invalid payout status: ${newStatus}`);
    });
  }

  async createBatchSettlement(actorId: string): Promise<any> {
    const minPayout = this.getMinPayoutLimit();
    const eligibleLedgers = await this.earningsRepo.find();
    const readyProviders = eligibleLedgers.filter((l) => l.balance >= minPayout);

    const batchRef = `BATCH-${Date.now()}`;
    let totalBatchAmount = 0;
    let totalSettled = 0;

    for (const p of readyProviders) {
      const payoutAmount = p.balance;
      totalBatchAmount += payoutAmount;
      totalSettled += 1;
    }

    const batch = new PayoutBatchEntity();
    batch.id = "batch-" + crypto.randomUUID();
    batch.batchReference = batchRef;
    batch.totalPayouts = totalSettled;
    batch.totalAmount = totalBatchAmount;
    batch.status = "completed";
    batch.processedBy = actorId;
    batch.createdAt = new Date().toISOString();

    if (this.batchRepo) {
      await this.batchRepo.save(batch);
    }

    return batch;
  }

  async getPayoutBatches(): Promise<PayoutBatchEntity[]> {
    if (this.batchRepo) {
      return this.batchRepo.find();
    }
    return [];
  }
}
