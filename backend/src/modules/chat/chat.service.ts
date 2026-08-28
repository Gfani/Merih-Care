import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  ConversationEntity,
  ConversationParticipantEntity,
  MessageEntity,
  MessageAttachmentEntity,
  MessageReportEntity,
} from "../../database/entities/chat-chat.entity";
import { AuditLogEntity } from "../../database/entities/logs-delivery.entity";

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(ConversationParticipantEntity)
    private readonly participantRepo: Repository<ConversationParticipantEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(MessageAttachmentEntity)
    private readonly attachmentRepo: Repository<MessageAttachmentEntity>,
    @InjectRepository(MessageReportEntity)
    private readonly reportRepo: Repository<MessageReportEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Conversation Management ─────────────────────────────────────

  async createConversation(
    participantIds: string[],
    appointmentId?: string,
    isProtected = false,
  ): Promise<ConversationEntity> {
    return this.dataSource.transaction(async (manager) => {
      const conv = new ConversationEntity();
      conv.id = `conv-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      conv.type = appointmentId ? "appointment" : participantIds.length > 2 ? "group" : "direct";
      conv.appointmentId = appointmentId || null;
      conv.isProtected = isProtected;
      conv.createdAt = new Date().toISOString();
      await manager.save(conv);

      for (let i = 0; i < participantIds.length; i++) {
        const p = new ConversationParticipantEntity();
        p.id = `part-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
        p.conversationId = conv.id;
        p.userId = participantIds[i];
        p.role = i === 0 ? "owner" : "member";
        p.isBlocked = false;
        p.joinedAt = new Date().toISOString();
        await manager.save(p);
      }

      return conv;
    });
  }

  async getConversations(userId: string): Promise<any[]> {
    const participations = await this.participantRepo.find({
      where: { userId },
    });

    const results: any[] = [];
    for (const p of participations) {
      const conv = await this.conversationRepo.findOne({ where: { id: p.conversationId } });
      if (!conv) continue;

      // Get last message preview
      const lastMessage = await this.messageRepo.findOne({
        where: { conversationId: conv.id, isDeleted: false },
        order: { createdAt: "DESC" },
      } as any);

      // Count all participants
      const participantCount = await this.participantRepo.count({
        where: { conversationId: conv.id },
      });

      results.push({
        ...conv,
        participantCount,
        lastMessage: lastMessage
          ? { text: conv.isProtected ? "[Protected content]" : lastMessage.text, createdAt: lastMessage.createdAt }
          : null,
        lastReadMessageId: p.lastReadMessageId,
      });
    }

    return results.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.createdAt;
      const bTime = b.lastMessage?.createdAt || b.createdAt;
      return bTime.localeCompare(aTime);
    });
  }

  // ─── Participant Utilities ────────────────────────────────────────

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const p = await this.participantRepo.findOne({ where: { conversationId, userId } });
    return !!p;
  }

  async isBlocked(conversationId: string, userId: string): Promise<boolean> {
    const p = await this.participantRepo.findOne({ where: { conversationId, userId } });
    return p?.isBlocked === true;
  }

  // ─── Messages ────────────────────────────────────────────────────

  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
    replyToId?: string,
  ): Promise<MessageEntity> {
    // Verify sender is a participant
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId: senderId },
    });
    if (!participant) throw new ForbiddenException("You are not a participant of this conversation");
    if (participant.isBlocked) throw new ForbiddenException("You have been blocked in this conversation");

    const conv = await this.conversationRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException("Conversation not found");

    const message = new MessageEntity();
    message.id = `msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    message.conversationId = conversationId;
    message.senderId = senderId;
    message.text = text;
    message.deliveryState = "sent";
    message.isDeleted = false;
    message.isSystemMessage = false;
    message.replyToId = replyToId || null;
    message.createdAt = new Date().toISOString();

    await this.messageRepo.save(message);

    // Update conversation lastMessageAt
    conv.lastMessageAt = message.createdAt;
    await this.conversationRepo.save(conv);

    return message;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    page = 1,
    limit = 30,
  ): Promise<{ messages: MessageEntity[]; total: number; page: number; totalPages: number }> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (!participant) throw new ForbiddenException("You are not a participant of this conversation");

    const conv = await this.conversationRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException("Conversation not found");

    const skip = (page - 1) * limit;

    const [allMessages, total] = await this.messageRepo.findAndCount({
      where: { conversationId, isDeleted: false },
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    } as any);

    // Protect medical info: strip system messages for non-owner participants
    const messages = conv.isProtected
      ? allMessages.filter((m) => !m.isSystemMessage || participant.role === "owner")
      : allMessages;

    return {
      messages: messages.reverse(),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markRead(conversationId: string, userId: string, messageId: string): Promise<void> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (!participant) throw new ForbiddenException("Not a participant");

    participant.lastReadMessageId = messageId;
    await this.participantRepo.save(participant);

    // Mark message as read
    await this.messageRepo.update({ id: messageId }, { deliveryState: "read" });
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException("Message not found");
    if (message.senderId !== userId) throw new ForbiddenException("Cannot delete another user's message");

    message.isDeleted = true;
    message.text = "[This message was deleted]";
    await this.messageRepo.save(message);
  }

  // ─── Attachments ─────────────────────────────────────────────────

  async getAttachments(conversationId: string, userId: string): Promise<MessageAttachmentEntity[]> {
    if (!(await this.isParticipant(conversationId, userId))) {
      throw new ForbiddenException("Not a participant");
    }

    // Get all message IDs for this conversation
    const messages = await this.messageRepo.find({
      where: { conversationId, isDeleted: false },
      select: ["id"],
    } as any);

    if (!messages.length) return [];

    const messageIds = messages.map((m) => m.id);
    return this.attachmentRepo
      .createQueryBuilder("a")
      .where("a.messageId IN (:...messageIds)", { messageIds })
      .getMany();
  }

  // ─── Blocking / Reporting ─────────────────────────────────────────

  async blockParticipant(
    conversationId: string,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    // Only owner or admin can block
    const actorParticipant = await this.participantRepo.findOne({
      where: { conversationId, userId: actorId },
    });
    if (!actorParticipant || actorParticipant.role !== "owner") {
      throw new ForbiddenException("Only conversation owners can block participants");
    }

    const target = await this.participantRepo.findOne({
      where: { conversationId, userId: targetId },
    });
    if (!target) throw new NotFoundException("Target is not in this conversation");

    target.isBlocked = true;
    target.blockedAt = new Date().toISOString();
    target.blockedBy = actorId;
    await this.participantRepo.save(target);
  }

  async reportMessage(messageId: string, reporterId: string, reason: string): Promise<MessageReportEntity> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) throw new NotFoundException("Message not found");

    // Verify reporter is a participant
    if (!(await this.isParticipant(message.conversationId, reporterId))) {
      throw new ForbiddenException("Cannot report a message you have no access to");
    }

    const report = new MessageReportEntity();
    report.id = `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    report.messageId = messageId;
    report.reporterId = reporterId;
    report.reason = reason;
    report.status = "pending";
    report.createdAt = new Date().toISOString();
    await this.reportRepo.save(report);

    // Also log in audit trail
    const log = new AuditLogEntity();
    log.id = `audit-${Date.now()}`;
    log.actorId = reporterId;
    log.action = "REPORT_MESSAGE";
    log.resource = `messages/${messageId}`;
    log.timestamp = new Date().toISOString();
    log.status = "success";
    log.payload = JSON.stringify({ reason, reportId: report.id });
    await this.auditRepo.save(log);

    return report;
  }

  // Legacy stub kept for backwards compatibility
  async getChatLogs(roomId: string): Promise<any[]> {
    const { messages } = await this.getMessages(roomId, "system", 1, 50).catch(() => ({
      messages: [],
    }));
    return messages;
  }
}
