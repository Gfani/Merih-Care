import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("conversations")
export class ConversationEntity {
  @PrimaryColumn()
  id: string;

  @Column({ default: "direct" })
  type: string; // direct | group | appointment

  @Column({ nullable: true })
  @Index()
  appointmentId: string; // links chat to appointment context

  @Column({ default: false })
  isProtected: boolean; // medical info protection flag

  @Column({ nullable: true })
  lastMessageAt: string;

  @Column()
  createdAt: string;
}

@Entity("conversation_participants")
export class ConversationParticipantEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  conversationId: string;

  @Column()
  @Index()
  userId: string;

  @Column({ default: "member" })
  role: string; // owner | member

  @Column({ nullable: true })
  lastReadMessageId: string; // for read receipts

  @Column({ nullable: true })
  lastReadAt: string;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ nullable: true })
  blockedAt: string;

  @Column({ nullable: true })
  blockedBy: string;

  @Column()
  joinedAt: string;
}

@Entity("messages")
export class MessageEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  conversationId: string;

  @Column()
  @Index()
  senderId: string;

  @Column({ type: "text" })
  text: string;

  @Column({ default: "sent" })
  deliveryState: string; // sent | delivered | read

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ default: false })
  isSystemMessage: boolean; // medical-system generated messages

  @Column({ nullable: true })
  replyToId: string; // thread reference

  @Column({ nullable: true })
  editedAt: string;

  @Column()
  createdAt: string;
}

@Entity("message_attachments")
export class MessageAttachmentEntity {
  @PrimaryColumn()
  id: string;

  @Column({ nullable: true })
  @Index()
  conversationId: string;

  @Column({ nullable: true })
  @Index()
  messageId: string;

  @Column({ nullable: true })
  uploaderId: string;

  @Column()
  fileUrl: string;

  @Column({ nullable: true })
  fileType: string;

  @Column({ default: 0 })
  fileSize: number;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  createdAt: string;
}

@Entity("message_reports")
export class MessageReportEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  messageId: string;

  @Column()
  @Index()
  reporterId: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ default: "pending" })
  status: string; // pending | reviewed | dismissed

  @Column()
  createdAt: string;
}
