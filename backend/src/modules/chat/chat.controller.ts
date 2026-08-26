import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ChatService } from "./chat.service";
import { JwtAuthGuard } from "../../shared/guards/jwt-auth.guard";
import { OwnershipGuard } from "../../shared/guards/ownership.guard";

@Controller("chat")
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(":roomId")
  async getChatLogs(@Param("roomId") roomId: string) {
    return this.chatService.getChatLogs(roomId);
  }
}
