import { Test, TestingModule } from "@nestjs/testing";
import { PaymentsService } from "./payments.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { PaymentEventEntity, RefundEntity, CommissionRecordEntity, ProviderEarningsEntity } from "../../database/entities/financial.entity";
import { BadRequestException } from "@nestjs/common";

describe("Refund Tests", () => {
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
      createQueryBuilder: jest.fn(),
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

  describe("refundPayment", () => {
    it("should process refund, cancel appointment, and adjust provider ledger", async () => {
      const apt = { id: "apt-1", amount: 1000, providerId: "prov-1", status: "scheduled" };
      const event = { id: "evt-1", paymentId: "tx-apt-1-123456", eventType: "charge_succeeded" };
      const ledger = { providerId: "prov-1", balance: 850, totalEarned: 850 };

      mockTransactionManager.findOne
        .mockResolvedValueOnce(apt)     // find appointment
        .mockResolvedValueOnce(null)    // check existing refund (none)
        .mockResolvedValueOnce(ledger); // find provider earnings

      mockTransactionManager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(event),
      });

      const refund = await service.refundPayment("apt-1", "Customer requested cancellation", "admin-1");

      expect(refund).toBeDefined();
      expect(refund.amount).toBe(1000);
      expect(refund.reason).toBe("Customer requested cancellation");
      expect(apt.status).toBe("cancelled");
      expect(ledger.balance).toBe(0);
      expect(mockTransactionManager.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException if appointment has no completed charge", async () => {
      const apt = { id: "apt-unpaid", amount: 1000 };
      mockTransactionManager.findOne.mockResolvedValueOnce(apt);
      mockTransactionManager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null), // no charge_succeeded event
      });

      await expect(
        service.refundPayment("apt-unpaid", "Reason", "admin-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException on double refund attempt", async () => {
      const apt = { id: "apt-refunded", amount: 1000 };
      const event = { id: "evt-1", paymentId: "tx-apt-refunded-123" };
      const existingRefund = { id: "ref-1", paymentId: "tx-apt-refunded-123" };

      mockTransactionManager.findOne
        .mockResolvedValueOnce(apt)
        .mockResolvedValueOnce(existingRefund); // existing refund found

      mockTransactionManager.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(event),
      });

      await expect(
        service.refundPayment("apt-refunded", "Reason", "admin-1"),
      ).rejects.toThrow(/already refunded/);
    });
  });
});
