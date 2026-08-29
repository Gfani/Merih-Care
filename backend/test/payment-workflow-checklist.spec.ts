import { PaymentsService } from "../src/modules/payments/payments.service";
import { ProviderEarningsService } from "../src/modules/earnings/earnings.service";
import { PayoutsService } from "../src/modules/payouts/payouts.service";
import { AppointmentEntity } from "../src/database/entities/appointment.entity";
import { ProviderEarningsEntity, PayoutEntity } from "../src/database/entities/financial.entity";
import * as crypto from "crypto";

describe("Payment Workflow Checklist Tests", () => {
  describe("Webhook HMAC-SHA256 Signature Verification", () => {
    let paymentsService: PaymentsService;
    let mockAptRepo: any;
    let mockEventRepo: any;
    let mockRefundRepo: any;
    let mockCommissionRepo: any;
    let mockEarningsRepo: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockAptRepo = {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      };
      mockEventRepo = {
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
        findOne: jest.fn(),
      };
      mockRefundRepo = {
        save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
      };
      mockCommissionRepo = {
        save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      };
      mockEarningsRepo = {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      };
      mockDataSource = {
        transaction: jest.fn().mockImplementation((cb) => cb({
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
        })),
      };

      paymentsService = new PaymentsService(
        mockAptRepo,
        mockEventRepo,
        mockRefundRepo,
        mockCommissionRepo,
        mockEarningsRepo,
        mockDataSource
      );
    });

    it("should accept valid webhook signature and process payment", async () => {
      const secret = "CHAPA_WEBHOOK_TEST_SECRET";
      const payload = {
        event: "charge.complete",
        tx_ref: "tx-apt-1-12345",
        status: "success",
        amount: 1200,
      };
      const rawBody = JSON.stringify(payload);
      const validSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      const apt = new AppointmentEntity();
      apt.id = "apt-1";
      apt.status = "requested";
      mockAptRepo.findOne.mockResolvedValue(apt);

      const result = await paymentsService.handleWebhook(payload, rawBody, validSignature);
      expect(result.success).toBe(true);
    });

    it("should reject invalid webhook signature with 401 error", async () => {
      const payload = { event: "charge.complete", tx_ref: "tx-apt-1" };
      const rawBody = JSON.stringify(payload);

      await expect(
        paymentsService.handleWebhook(payload, rawBody, "invalid-hmac-signature")
      ).rejects.toThrow("Webhook signature verification failed");
    });
  });

  describe("Provider Earnings CSV Export", () => {
    let earningsService: ProviderEarningsService;
    let mockEarningsRepo: any;
    let mockPayoutRepo: any;

    beforeEach(() => {
      mockEarningsRepo = {
        findOne: jest.fn().mockResolvedValue({
          providerId: "p-1",
          balance: 8500,
          totalEarned: 24000,
          totalWithdrawn: 15500,
        }),
      };
      mockPayoutRepo = {
        find: jest.fn().mockResolvedValue([
          { id: "pay-101", amount: 5000, status: "completed", createdAt: "2026-08-20T10:00:00Z" },
        ]),
      };
      earningsService = new ProviderEarningsService(mockEarningsRepo, mockPayoutRepo);
    });

    it("should generate formatted CSV containing statements and summaries", async () => {
      const csv = await earningsService.exportEarningsCsv("p-1");
      expect(csv).toContain("Transaction ID,Date,Amount (ETB),Status,Description");
      expect(csv).toContain("pay-101");
      expect(csv).toContain("Summary Total Earned");
      expect(csv).toContain("24000");
    });
  });

  describe("Payout Batch Settlement", () => {
    let payoutsService: PayoutsService;
    let mockPayoutRepo: any;
    let mockEarningsRepo: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockPayoutRepo = {
        find: jest.fn().mockResolvedValue([]),
      };
      mockEarningsRepo = {
        find: jest.fn().mockResolvedValue([
          { providerId: "p-1", balance: 2500 },
          { providerId: "p-2", balance: 1800 },
          { providerId: "p-3", balance: 200 }, // Below 500 ETB min threshold
        ]),
      };
      mockDataSource = {} as any;
      payoutsService = new PayoutsService(mockPayoutRepo, mockEarningsRepo, mockDataSource);
    });

    it("should create consolidated settlement batch for eligible providers", async () => {
      const batch = await payoutsService.createBatchSettlement("admin-1");
      expect(batch.totalPayouts).toBe(2);
      expect(batch.totalAmount).toBe(4300);
      expect(batch.status).toBe("completed");
    });
  });
});
