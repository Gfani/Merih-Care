import { Test, TestingModule } from "@nestjs/testing";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { PaymentEventEntity, RefundEntity, CommissionRecordEntity, ProviderEarningsEntity } from "../../database/entities/financial.entity";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";

describe("PaymentsController", () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(AppointmentEntity),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(PaymentEventEntity),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefundEntity),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(CommissionRecordEntity),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProviderEarningsEntity),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
