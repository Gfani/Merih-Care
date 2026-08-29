import { Test, TestingModule } from "@nestjs/testing";
import { ChatService } from "./chat.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  ConversationEntity,
  ConversationParticipantEntity,
  MessageEntity,
  MessageAttachmentEntity,
  MessageReportEntity,
} from "../../database/entities/chat-chat.entity";
import { AuditLogEntity } from "../../database/entities/logs-delivery.entity";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

describe("Chat Authorization Tests", () => {
  let service: ChatService;

  const mockConvRepo = { findOne: jest.fn(), save: jest.fn() };
  const mockPartRepo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn(), count: jest.fn() };
  const mockMsgRepo = { findOne: jest.fn(), save: jest.fn(), findAndCount: jest.fn(), update: jest.fn() };
  const mockAttachRepo = { find: jest.fn() };
  const mockReportRepo = { save: jest.fn() };
  const mockAuditRepo = { save: jest.fn() };
  const mockDataSource = { transaction: jest.fn().mockImplementation((cb) => cb({ save: jest.fn() })) };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ConversationEntity), useValue: mockConvRepo },
        { provide: getRepositoryToken(ConversationParticipantEntity), useValue: mockPartRepo },
        { provide: getRepositoryToken(MessageEntity), useValue: mockMsgRepo },
        { provide: getRepositoryToken(MessageAttachmentEntity), useValue: mockAttachRepo },
        { provide: getRepositoryToken(MessageReportEntity), useValue: mockReportRepo },
        { provide: getRepositoryToken(AuditLogEntity), useValue: mockAuditRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe("sendMessage authorization", () => {
    it("should allow a valid participant to send a message", async () => {
      mockPartRepo.findOne.mockResolvedValue({ id: "part-1", conversationId: "conv-1", userId: "u-1", isBlocked: false });
      mockConvRepo.findOne.mockResolvedValue({ id: "conv-1" });
      mockMsgRepo.save.mockImplementation((m) => Promise.resolve(m));

      const msg = await service.sendMessage("conv-1", "u-1", "Hello Dr. Meron");

      expect(msg).toBeDefined();
      expect(msg.text).toBe("Hello Dr. Meron");
      expect(msg.senderId).toBe("u-1");
    });

    it("should throw ForbiddenException if sender is not a participant", async () => {
      mockPartRepo.findOne.mockResolvedValue(null); // non-participant

      await expect(service.sendMessage("conv-1", "hacker-user", "Infiltrated message"))
        .rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException if participant is blocked in the conversation", async () => {
      mockPartRepo.findOne.mockResolvedValue({ id: "part-1", conversationId: "conv-1", userId: "u-blocked", isBlocked: true });

      await expect(service.sendMessage("conv-1", "u-blocked", "Spam message"))
        .rejects.toThrow(/blocked/);
    });
  });

  describe("getMessages authorization", () => {
    it("should reject non-participant from reading messages", async () => {
      mockPartRepo.findOne.mockResolvedValue(null);

      await expect(service.getMessages("conv-1", "stranger-user"))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe("deleteMessage authorization", () => {
    it("should reject deleting another user's message", async () => {
      mockMsgRepo.findOne.mockResolvedValue({ id: "msg-101", senderId: "original-author" });

      await expect(service.deleteMessage("msg-101", "other-user"))
        .rejects.toThrow(/Cannot delete another user's message/);
    });
  });

  describe("blockParticipant authorization", () => {
    it("should reject non-owner from blocking members", async () => {
      mockPartRepo.findOne.mockResolvedValueOnce({ role: "member" }); // actor is regular member

      await expect(service.blockParticipant("conv-1", "regular-member", "target-user"))
        .rejects.toThrow(/Only conversation owners can block participants/);
    });
  });
});
