import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import {
  ConversationEntity,
  ConversationParticipantEntity,
  MessageEntity,
  MessageAttachmentEntity,
  MessageReportEntity,
} from "../../database/entities/chat-chat.entity";
import { AuditLogEntity } from "../../database/entities/logs-delivery.entity";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationEntity,
      ConversationParticipantEntity,
      MessageEntity,
      MessageAttachmentEntity,
      MessageReportEntity,
      AuditLogEntity,
    ]),
    AuthModule,
    JwtModule.register({}), // Gateway uses JwtService from AppModule global
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
