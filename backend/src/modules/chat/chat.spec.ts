import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  ConversationEntity,
  ConversationParticipantEntity,
  MessageEntity,
  MessageAttachmentEntity,
  MessageReportEntity,
} from "../../database/entities/chat-chat.entity";
import { AuditLogEntity } from "../../database/entities/logs-delivery.entity";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

describe("ChatController", () => {
  let controller: ChatController;
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        { provide: getRepositoryToken(ConversationEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ConversationParticipantEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(MessageEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(MessageAttachmentEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(MessageReportEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockRepo() },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });
});
