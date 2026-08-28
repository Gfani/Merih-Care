import { Test, TestingModule } from "@nestjs/testing";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotificationEntity, NotificationPreferenceEntity } from "../../database/entities/notification.entity";
import { NotificationDeliveryAttemptEntity } from "../../database/entities/logs-delivery.entity";
import { JwtService } from "@nestjs/jwt";
import { RealtimeService } from "../realtime/realtime.service";

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  })),
});

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(NotificationEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(NotificationPreferenceEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(NotificationDeliveryAttemptEntity), useValue: mockRepo() },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: RealtimeService, useValue: { emitToRoom: jest.fn(), emitNotification: jest.fn() } },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
