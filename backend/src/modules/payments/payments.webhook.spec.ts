import { Test, TestingModule } from "@nestjs/testing";
import { PaymentsService } from "./payments.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { PaymentEventEntity, RefundEntity, CommissionRecordEntity, ProviderEarningsEntity } from "../../database/entities/financial.entity";
import * as crypto from "crypto";
import { BadRequestException } from "@nestjs/common";

describe("Payment Webhook Tests", () => {
  let service: PaymentsService;
  let mockTransactionManager: any;

  const mockAppointmentRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const mockEventRepo = { save: jest.fn() };
  const mockRefundRepo = { save: jest.fn() };
  const mockCommissionRepo = { save: jest.fn() };
  const mockEarningsRepo = { save: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockTransactionManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockTransactionManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(AppointmentEntity), useValue: mockAppointmentRepo },
        { provide: getRepositoryToken(PaymentEventEntity), useValue: mockEventRepo },
        { provide: getRepositoryToken(RefundEntity), useValue: mockRefundRepo },
        { provide: getRepositoryToken(CommissionRecordEntity), useValue: mockCommissionRepo },
        { provide: getRepositoryToken(ProviderEarningsEntity), useValue: mockEarningsRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe("handleWebhook", () => {
    it("should process webhook and settle appointment & commission", async () => {
      const rawPayload = JSON.stringify({ status: "success", tx_ref: "tx-apt101-123456", amount: 1000 });
      const signature = crypto
        .createHmac("sha256", "CHAPA_WEBHOOK_TEST_SECRET")
        .update(rawPayload)
        .digest("hex");

      const apt = { id: "apt101", amount: 1000, providerId: "p-1", status: "requested" };
      mockTransactionManager.findOne
        .mockResolvedValueOnce(null) // idempotency check: no existing charge_succeeded
        .mockResolvedValueOnce(apt)  // find appointment
        .mockResolvedValueOnce({ providerId: "p-1", balance: 0, totalEarned: 0 }); // find earnings ledger

      const result = await service.handleWebhook(
        { status: "success", tx_ref: "tx-apt101-123456" },
        rawPayload,
        signature,
      );

      expect(result.status).toBe("processed");
      expect(mockTransactionManager.save).toHaveBeenCalled();
    });

    it("should reject webhook with invalid signature", async () => {
      // Mock different webhook secret
      (service as any).chapaWebhookSecret = "CUSTOM_SECRET_999";

      const rawPayload = JSON.stringify({ status: "success", tx_ref: "tx-apt101-123456" });
      const invalidSignature = "invalid_signature_hex";

      await expect(
        service.handleWebhook({ status: "success", tx_ref: "tx-apt101-123456" }, rawPayload, invalidSignature),
      ).rejects.toThrow(BadRequestException);
    });

    it("should ignore webhook with non-success status", async () => {
      const rawPayload = JSON.stringify({ status: "failed", tx_ref: "tx-apt101-123456" });
      const signature = crypto
        .createHmac("sha256", "CHAPA_WEBHOOK_TEST_SECRET")
        .update(rawPayload)
        .digest("hex");

      const result = await service.handleWebhook(
        { status: "failed", tx_ref: "tx-apt101-123456" },
        rawPayload,
        signature,
      );

      expect(result.status).toBe("ignored");
    });
  });

  describe("processSuccessfulPayment Idempotency", () => {
    it("should not double credit or re-process already handled transactions", async () => {
      mockTransactionManager.findOne.mockResolvedValueOnce({
        id: "evt-existing",
        paymentId: "tx-apt101-123456",
        eventType: "charge_succeeded",
      });

      await service.processSuccessfulPayment("tx-apt101-123456", { status: "success" });

      // Should return immediately without re-saving
      expect(mockTransactionManager.save).not.toHaveBeenCalled();
    });
  });
});
