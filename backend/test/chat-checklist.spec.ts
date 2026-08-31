import { ChatService } from "../src/modules/chat/chat.service";
import {
  ConversationEntity,
  ConversationParticipantEntity,
  MessageEntity,
  MessageAttachmentEntity,
  MessageReportEntity,
} from "../src/database/entities/chat-chat.entity";

describe("Chat & Messaging Checklist Tests", () => {
  let service: ChatService;
  let mockConvRepo: any;
  let mockPartRepo: any;
  let mockMsgRepo: any;
  let mockAttRepo: any;
  let mockReportRepo: any;
  let mockAuditRepo: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockConvRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockPartRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      count: jest.fn().mockResolvedValue(2),
    };
    mockMsgRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((m) => Promise.resolve(m)),
      count: jest.fn().mockResolvedValue(0),
    };
    mockAttRepo = {
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      find: jest.fn().mockResolvedValue([]),
    };
    mockReportRepo = {
      save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
    };
    mockAuditRepo = {
      save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
    };
    mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb({
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      })),
    };

    service = new ChatService(
      mockConvRepo,
      mockPartRepo,
      mockMsgRepo,
      mockAttRepo,
      mockReportRepo,
      mockAuditRepo,
      mockDataSource
    );
  });

  describe("Read Receipts & Unread Tracking", () => {
    it("should update lastReadMessageId and timestamp on markConversationRead", async () => {
      const participant = new ConversationParticipantEntity();
      participant.id = "p-1";
      participant.conversationId = "conv-1";
      participant.userId = "user-1";
      mockPartRepo.findOne.mockResolvedValue(participant);

      await service.markConversationRead("conv-1", "user-1", "msg-101");
      expect(participant.lastReadMessageId).toBe("msg-101");
      expect(participant.lastReadAt).toBeDefined();
      expect(mockPartRepo.save).toHaveBeenCalled();
    });
  });

  describe("Attachment Uploads", () => {
    it("should save attachment record for verified conversation participant", async () => {
      const participant = new ConversationParticipantEntity();
      participant.id = "p-1";
      participant.conversationId = "conv-1";
      participant.userId = "user-1";
      participant.isBlocked = false;
      mockPartRepo.findOne.mockResolvedValue(participant);

      const attachment = await service.uploadAttachment(
        "conv-1",
        "user-1",
        "https://storage.merihcare.et/scans/xray.png",
        "image/png",
        2048500
      );

      expect(attachment.fileUrl).toContain("xray.png");
      expect(attachment.fileSize).toBe(2048500);
      expect(mockAttRepo.save).toHaveBeenCalled();
    });
  });

  describe("Conversation Lifecycle & Support Escalation", () => {
    it("should allow conversation owner to delete conversation", async () => {
      const participant = new ConversationParticipantEntity();
      participant.id = "p-1";
      participant.role = "owner";
      mockPartRepo.findOne.mockResolvedValue(participant);

      await service.deleteConversation("conv-1", "user-1");
      expect(mockConvRepo.delete).toHaveBeenCalledWith({ id: "conv-1" });
    });

    it("should reject deletion if actor is not conversation owner", async () => {
      const participant = new ConversationParticipantEntity();
      participant.id = "p-1";
      participant.role = "member";
      mockPartRepo.findOne.mockResolvedValue(participant);

      await expect(service.deleteConversation("conv-1", "user-1")).rejects.toThrow(
        "Only the conversation owner can delete the conversation"
      );
    });

    it("should escalate conversation to support pool", async () => {
      const participant = new ConversationParticipantEntity();
      participant.id = "p-1";
      participant.isBlocked = false;
      mockPartRepo.findOne.mockResolvedValue(participant);

      const conv = new ConversationEntity();
      conv.id = "conv-1";
      mockConvRepo.findOne.mockResolvedValue(conv);

      const result = await service.escalateToSupport("conv-1", "user-1", "Patient reported severe distress");
      expect(result.status).toBe("escalated");
      expect(result.assignedSupportId).toBe("u-admin-support");
    });
  });
});
