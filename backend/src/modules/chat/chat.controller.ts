import {
  Controller, Get, Post, Delete, Patch, Body, Param, Query,
  UseGuards, Req
} from "@nestjs/common";
import { ChatService } from "./chat.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { IsNotEmpty, IsString, IsOptional, IsArray, MaxLength, IsBoolean, IsNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateConversationDto {
  @ApiProperty({ description: "List of user IDs to include in the conversation" })
  @IsArray()
  participantIds: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @ApiProperty({ required: false, description: "Flag for medical-protected conversations" })
  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;
}

export class SendMessageDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  text: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class ReportMessageDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class UploadAttachmentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  fileType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  fileSize: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  messageId?: string;
}

export class EscalateChatDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  reason: string;
}

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("conversations")
  async createConversation(@Body() body: CreateConversationDto, @Req() req: any) {
    const userId = req.user?.id;
    const participantIds = Array.from(new Set([userId, ...body.participantIds]));
    return this.chatService.createConversation(
      participantIds,
      body.appointmentId,
      body.isProtected ?? false,
    );
  }

  @Get("conversations")
  async getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user?.id);
  }

  @Delete("conversations/:id")
  async deleteConversation(@Param("id") conversationId: string, @Req() req: any) {
    await this.chatService.deleteConversation(conversationId, req.user?.id);
    return { success: true };
  }

  @Patch("conversations/:id/read")
  async markRead(
    @Param("id") conversationId: string,
    @Body("messageId") messageId: string,
    @Req() req: any
  ) {
    await this.chatService.markConversationRead(conversationId, req.user?.id, messageId);
    return { success: true };
  }

  @Get("conversations/:id/messages")
  async getMessages(
    @Param("id") conversationId: string,
    @Query("page") page: string,
    @Query("limit") limit: string,
    @Req() req: any,
  ) {
    return this.chatService.getMessages(
      conversationId,
      req.user?.id,
      parseInt(page) || 1,
      parseInt(limit) || 30,
    );
  }

  @Post("conversations/:id/messages")
  async sendMessage(
    @Param("id") conversationId: string,
    @Body() body: SendMessageDto,
    @Req() req: any,
  ) {
    return this.chatService.sendMessage(conversationId, req.user?.id, body.text, body.replyToId);
  }

  @Post("conversations/:id/attachments")
  async uploadAttachment(
    @Param("id") conversationId: string,
    @Body() body: UploadAttachmentDto,
    @Req() req: any
  ) {
    return this.chatService.uploadAttachment(
      conversationId,
      req.user?.id,
      body.fileUrl,
      body.fileType,
      body.fileSize,
      body.messageId
    );
  }

  @Get("conversations/:id/attachments")
  async getAttachments(@Param("id") conversationId: string, @Req() req: any) {
    return this.chatService.getAttachments(conversationId, req.user?.id);
  }

  @Post("conversations/:id/escalate")
  async escalateToSupport(
    @Param("id") conversationId: string,
    @Body() body: EscalateChatDto,
    @Req() req: any
  ) {
    return this.chatService.escalateToSupport(conversationId, req.user?.id, body.reason);
  }

  @Post("conversations/:id/block/:targetId")
  async blockParticipant(
    @Param("id") conversationId: string,
    @Param("targetId") targetId: string,
    @Req() req: any,
  ) {
    await this.chatService.blockParticipant(conversationId, req.user?.id, targetId);
    return { success: true };
  }

  @Post("messages/:id/report")
  async reportMessage(
    @Param("id") messageId: string,
    @Body() body: ReportMessageDto,
    @Req() req: any,
  ) {
    return this.chatService.reportMessage(messageId, req.user?.id, body.reason);
  }

  @Patch("messages/:id")
  async editMessage(
    @Param("id") messageId: string,
    @Body("text") text: string,
    @Req() req: any
  ) {
    return this.chatService.editMessage(messageId, req.user?.id, text);
  }

  @Delete("messages/:id")
  async deleteMessage(@Param("id") messageId: string, @Req() req: any) {
    await this.chatService.deleteMessage(messageId, req.user?.id);
    return { success: true };
  }

  @Get("conversations/:id/search")
  async searchMessages(
    @Param("id") conversationId: string,
    @Query("q") query: string,
    @Req() req: any
  ) {
    const actorId = req.user?.id || req.user?.sub;
    const actorRole = req.user?.role;
    return this.chatService.searchMessages(conversationId, actorId, query || "", actorRole);
  }

  // Legacy
  @Get(":roomId")
  async getChatLogs(@Param("roomId") roomId: string) {
    return this.chatService.getChatLogs(roomId);
  }
}
