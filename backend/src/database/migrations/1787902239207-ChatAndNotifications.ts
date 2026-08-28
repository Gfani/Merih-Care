import { MigrationInterface, QueryRunner } from "typeorm";

export class ChatAndNotifications1787902239207 implements MigrationInterface {
    name = 'ChatAndNotifications1787902239207'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "message_reports" ("id" varchar PRIMARY KEY NOT NULL, "messageId" varchar NOT NULL, "reporterId" varchar NOT NULL, "reason" varchar, "status" varchar NOT NULL DEFAULT ('pending'), "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_7078835e4cc127f9394f40ac6e" ON "message_reports" ("messageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a5443479693a8c62470e15fed" ON "message_reports" ("reporterId") `);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "type" varchar NOT NULL, "title" varchar NOT NULL, "body" text NOT NULL, "data" text, "isRead" boolean NOT NULL DEFAULT (0), "readAt" varchar, "channel" varchar NOT NULL DEFAULT ('in_app'), "priority" varchar NOT NULL DEFAULT ('normal'), "idempotencyKey" varchar, "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_831a5a06f879fb0bebf8965871" ON "notifications" ("createdAt") `);
        await queryRunner.query(`CREATE TABLE "notification_preferences" ("userId" varchar PRIMARY KEY NOT NULL, "inApp" boolean NOT NULL DEFAULT (1), "push" boolean NOT NULL DEFAULT (1), "email" boolean NOT NULL DEFAULT (1), "sms" boolean NOT NULL DEFAULT (0), "appointmentReminders" boolean NOT NULL DEFAULT (1), "chatMessages" boolean NOT NULL DEFAULT (1), "paymentUpdates" boolean NOT NULL DEFAULT (1), "emergencyAlerts" boolean NOT NULL DEFAULT (1), "updatedAt" varchar)`);
        await queryRunner.query(`CREATE TABLE "temporary_conversations" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL DEFAULT ('direct'), "createdAt" varchar NOT NULL, "appointmentId" varchar, "isProtected" boolean NOT NULL DEFAULT (0), "lastMessageAt" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_conversations"("id", "type", "createdAt") SELECT "id", "type", "createdAt" FROM "conversations"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`ALTER TABLE "temporary_conversations" RENAME TO "conversations"`);
        await queryRunner.query(`DROP INDEX "IDX_18c4ba3b127461649e5f5039db"`);
        await queryRunner.query(`DROP INDEX "IDX_4453e20858b14ab765a09ad728"`);
        await queryRunner.query(`CREATE TABLE "temporary_conversation_participants" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "userId" varchar NOT NULL, "joinedAt" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('member'), "lastReadMessageId" varchar, "isBlocked" boolean NOT NULL DEFAULT (0), "blockedAt" varchar, "blockedBy" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_conversation_participants"("id", "conversationId", "userId", "joinedAt") SELECT "id", "conversationId", "userId", "joinedAt" FROM "conversation_participants"`);
        await queryRunner.query(`DROP TABLE "conversation_participants"`);
        await queryRunner.query(`ALTER TABLE "temporary_conversation_participants" RENAME TO "conversation_participants"`);
        await queryRunner.query(`CREATE INDEX "IDX_18c4ba3b127461649e5f5039db" ON "conversation_participants" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4453e20858b14ab765a09ad728" ON "conversation_participants" ("conversationId") `);
        await queryRunner.query(`DROP INDEX "IDX_2db9cf2b3ca111742793f6c37c"`);
        await queryRunner.query(`DROP INDEX "IDX_e5663ce0c730b2de83445e2fd1"`);
        await queryRunner.query(`CREATE TABLE "temporary_messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "senderId" varchar NOT NULL, "text" varchar NOT NULL, "createdAt" varchar NOT NULL, "deliveryState" varchar NOT NULL DEFAULT ('sent'), "isDeleted" boolean NOT NULL DEFAULT (0), "isSystemMessage" boolean NOT NULL DEFAULT (0), "replyToId" varchar, "editedAt" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_messages"("id", "conversationId", "senderId", "text", "createdAt") SELECT "id", "conversationId", "senderId", "text", "createdAt" FROM "messages"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`ALTER TABLE "temporary_messages" RENAME TO "messages"`);
        await queryRunner.query(`CREATE INDEX "IDX_2db9cf2b3ca111742793f6c37c" ON "messages" ("senderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e5663ce0c730b2de83445e2fd1" ON "messages" ("conversationId") `);
        await queryRunner.query(`DROP INDEX "IDX_5b4f24737fcb6b35ffdd4d16e1"`);
        await queryRunner.query(`CREATE TABLE "temporary_message_attachments" ("id" varchar PRIMARY KEY NOT NULL, "messageId" varchar NOT NULL, "fileUrl" varchar NOT NULL, "fileType" varchar, "fileSize" integer NOT NULL DEFAULT (0), "fileName" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_message_attachments"("id", "messageId", "fileUrl", "fileType", "fileSize") SELECT "id", "messageId", "fileUrl", "fileType", "fileSize" FROM "message_attachments"`);
        await queryRunner.query(`DROP TABLE "message_attachments"`);
        await queryRunner.query(`ALTER TABLE "temporary_message_attachments" RENAME TO "message_attachments"`);
        await queryRunner.query(`CREATE INDEX "IDX_5b4f24737fcb6b35ffdd4d16e1" ON "message_attachments" ("messageId") `);
        await queryRunner.query(`DROP INDEX "IDX_6d2b2a13d83a5670f81a9241f4"`);
        await queryRunner.query(`DROP INDEX "IDX_7386a6f47152f6f0986c4799c8"`);
        await queryRunner.query(`CREATE TABLE "temporary_notification_delivery_attempts" ("id" varchar PRIMARY KEY NOT NULL, "notificationId" varchar NOT NULL, "userId" varchar NOT NULL, "channel" varchar NOT NULL, "status" varchar NOT NULL, "retryCount" integer NOT NULL DEFAULT (0), "errorMessage" varchar, "createdAt" varchar NOT NULL, "provider" varchar, "nextRetryAt" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_notification_delivery_attempts"("id", "notificationId", "userId", "channel", "status", "retryCount", "errorMessage", "createdAt") SELECT "id", "notificationId", "userId", "channel", "status", "retryCount", "errorMessage", "createdAt" FROM "notification_delivery_attempts"`);
        await queryRunner.query(`DROP TABLE "notification_delivery_attempts"`);
        await queryRunner.query(`ALTER TABLE "temporary_notification_delivery_attempts" RENAME TO "notification_delivery_attempts"`);
        await queryRunner.query(`CREATE INDEX "IDX_6d2b2a13d83a5670f81a9241f4" ON "notification_delivery_attempts" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7386a6f47152f6f0986c4799c8" ON "notification_delivery_attempts" ("notificationId") `);
        await queryRunner.query(`DROP INDEX "IDX_2db9cf2b3ca111742793f6c37c"`);
        await queryRunner.query(`DROP INDEX "IDX_e5663ce0c730b2de83445e2fd1"`);
        await queryRunner.query(`CREATE TABLE "temporary_messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "senderId" varchar NOT NULL, "text" text NOT NULL, "createdAt" varchar NOT NULL, "deliveryState" varchar NOT NULL DEFAULT ('sent'), "isDeleted" boolean NOT NULL DEFAULT (0), "isSystemMessage" boolean NOT NULL DEFAULT (0), "replyToId" varchar, "editedAt" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_messages"("id", "conversationId", "senderId", "text", "createdAt", "deliveryState", "isDeleted", "isSystemMessage", "replyToId", "editedAt") SELECT "id", "conversationId", "senderId", "text", "createdAt", "deliveryState", "isDeleted", "isSystemMessage", "replyToId", "editedAt" FROM "messages"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`ALTER TABLE "temporary_messages" RENAME TO "messages"`);
        await queryRunner.query(`CREATE INDEX "IDX_2db9cf2b3ca111742793f6c37c" ON "messages" ("senderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e5663ce0c730b2de83445e2fd1" ON "messages" ("conversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e9e8bcc8d8c2fb3a1ebbf28876" ON "conversations" ("appointmentId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_e9e8bcc8d8c2fb3a1ebbf28876"`);
        await queryRunner.query(`DROP INDEX "IDX_e5663ce0c730b2de83445e2fd1"`);
        await queryRunner.query(`DROP INDEX "IDX_2db9cf2b3ca111742793f6c37c"`);
        await queryRunner.query(`ALTER TABLE "messages" RENAME TO "temporary_messages"`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "senderId" varchar NOT NULL, "text" varchar NOT NULL, "createdAt" varchar NOT NULL, "deliveryState" varchar NOT NULL DEFAULT ('sent'), "isDeleted" boolean NOT NULL DEFAULT (0), "isSystemMessage" boolean NOT NULL DEFAULT (0), "replyToId" varchar, "editedAt" varchar)`);
        await queryRunner.query(`INSERT INTO "messages"("id", "conversationId", "senderId", "text", "createdAt", "deliveryState", "isDeleted", "isSystemMessage", "replyToId", "editedAt") SELECT "id", "conversationId", "senderId", "text", "createdAt", "deliveryState", "isDeleted", "isSystemMessage", "replyToId", "editedAt" FROM "temporary_messages"`);
        await queryRunner.query(`DROP TABLE "temporary_messages"`);
        await queryRunner.query(`CREATE INDEX "IDX_e5663ce0c730b2de83445e2fd1" ON "messages" ("conversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2db9cf2b3ca111742793f6c37c" ON "messages" ("senderId") `);
        await queryRunner.query(`DROP INDEX "IDX_7386a6f47152f6f0986c4799c8"`);
        await queryRunner.query(`DROP INDEX "IDX_6d2b2a13d83a5670f81a9241f4"`);
        await queryRunner.query(`ALTER TABLE "notification_delivery_attempts" RENAME TO "temporary_notification_delivery_attempts"`);
        await queryRunner.query(`CREATE TABLE "notification_delivery_attempts" ("id" varchar PRIMARY KEY NOT NULL, "notificationId" varchar NOT NULL, "userId" varchar NOT NULL, "channel" varchar NOT NULL, "status" varchar NOT NULL, "retryCount" integer NOT NULL DEFAULT (0), "errorMessage" varchar, "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "notification_delivery_attempts"("id", "notificationId", "userId", "channel", "status", "retryCount", "errorMessage", "createdAt") SELECT "id", "notificationId", "userId", "channel", "status", "retryCount", "errorMessage", "createdAt" FROM "temporary_notification_delivery_attempts"`);
        await queryRunner.query(`DROP TABLE "temporary_notification_delivery_attempts"`);
        await queryRunner.query(`CREATE INDEX "IDX_7386a6f47152f6f0986c4799c8" ON "notification_delivery_attempts" ("notificationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d2b2a13d83a5670f81a9241f4" ON "notification_delivery_attempts" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_5b4f24737fcb6b35ffdd4d16e1"`);
        await queryRunner.query(`ALTER TABLE "message_attachments" RENAME TO "temporary_message_attachments"`);
        await queryRunner.query(`CREATE TABLE "message_attachments" ("id" varchar PRIMARY KEY NOT NULL, "messageId" varchar NOT NULL, "fileUrl" varchar NOT NULL, "fileType" varchar, "fileSize" integer NOT NULL DEFAULT (0))`);
        await queryRunner.query(`INSERT INTO "message_attachments"("id", "messageId", "fileUrl", "fileType", "fileSize") SELECT "id", "messageId", "fileUrl", "fileType", "fileSize" FROM "temporary_message_attachments"`);
        await queryRunner.query(`DROP TABLE "temporary_message_attachments"`);
        await queryRunner.query(`CREATE INDEX "IDX_5b4f24737fcb6b35ffdd4d16e1" ON "message_attachments" ("messageId") `);
        await queryRunner.query(`DROP INDEX "IDX_e5663ce0c730b2de83445e2fd1"`);
        await queryRunner.query(`DROP INDEX "IDX_2db9cf2b3ca111742793f6c37c"`);
        await queryRunner.query(`ALTER TABLE "messages" RENAME TO "temporary_messages"`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "senderId" varchar NOT NULL, "text" varchar NOT NULL, "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "messages"("id", "conversationId", "senderId", "text", "createdAt") SELECT "id", "conversationId", "senderId", "text", "createdAt" FROM "temporary_messages"`);
        await queryRunner.query(`DROP TABLE "temporary_messages"`);
        await queryRunner.query(`CREATE INDEX "IDX_e5663ce0c730b2de83445e2fd1" ON "messages" ("conversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2db9cf2b3ca111742793f6c37c" ON "messages" ("senderId") `);
        await queryRunner.query(`DROP INDEX "IDX_4453e20858b14ab765a09ad728"`);
        await queryRunner.query(`DROP INDEX "IDX_18c4ba3b127461649e5f5039db"`);
        await queryRunner.query(`ALTER TABLE "conversation_participants" RENAME TO "temporary_conversation_participants"`);
        await queryRunner.query(`CREATE TABLE "conversation_participants" ("id" varchar PRIMARY KEY NOT NULL, "conversationId" varchar NOT NULL, "userId" varchar NOT NULL, "joinedAt" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "conversation_participants"("id", "conversationId", "userId", "joinedAt") SELECT "id", "conversationId", "userId", "joinedAt" FROM "temporary_conversation_participants"`);
        await queryRunner.query(`DROP TABLE "temporary_conversation_participants"`);
        await queryRunner.query(`CREATE INDEX "IDX_4453e20858b14ab765a09ad728" ON "conversation_participants" ("conversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_18c4ba3b127461649e5f5039db" ON "conversation_participants" ("userId") `);
        await queryRunner.query(`ALTER TABLE "conversations" RENAME TO "temporary_conversations"`);
        await queryRunner.query(`CREATE TABLE "conversations" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL DEFAULT ('direct'), "createdAt" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "conversations"("id", "type", "createdAt") SELECT "id", "type", "createdAt" FROM "temporary_conversations"`);
        await queryRunner.query(`DROP TABLE "temporary_conversations"`);
        await queryRunner.query(`DROP TABLE "notification_preferences"`);
        await queryRunner.query(`DROP INDEX "IDX_831a5a06f879fb0bebf8965871"`);
        await queryRunner.query(`DROP INDEX "IDX_692a909ee0fa9383e7859f9b40"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP INDEX "IDX_5a5443479693a8c62470e15fed"`);
        await queryRunner.query(`DROP INDEX "IDX_7078835e4cc127f9394f40ac6e"`);
        await queryRunner.query(`DROP TABLE "message_reports"`);
    }

}
