import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity("conversations")
export class ConversationEntity {
  @PrimaryColumn()
  id: string;

  @Column({ default: "direct" })
  type: string;

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

  @Column()
  text: string;

  @Column()
  createdAt: string;
}

@Entity("message_attachments")
export class MessageAttachmentEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  messageId: string;

  @Column()
  fileUrl: string;

  @Column({ nullable: true })
  fileType: string;

  @Column({ default: 0 })
  fileSize: number;
}
