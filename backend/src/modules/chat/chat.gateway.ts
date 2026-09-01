import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ChatService } from "./chat.service";

const allowedOrigins = process.env.NODE_ENV === "production"
  ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["https://admin.merihcare.et", "https://app.merihcare.et"])
  : true;

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  namespace: "/chat",
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    // JWT auth middleware — rejects unauthenticated connections
    server.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");
        if (!token) return next(new Error("Unauthorized: no token"));
        const payload = await this.jwtService.verifyAsync(token);
        (socket as any).userId = payload.sub || payload.id;
        next();
      } catch {
        next(new Error("Unauthorized: invalid token"));
      }
    });
  }

  handleConnection(socket: Socket) {
    const userId = (socket as any).userId;
    if (!userId) {
      socket.disconnect();
      return;
    }
    // Join a personal room so we can send targeted notifications
    socket.join(`user:${userId}`);
  }

  handleDisconnect(socket: Socket) {
    const userId = (socket as any).userId;
    if (userId) socket.leave(`user:${userId}`);
  }

  // Join a conversation room (verifies membership)
  @SubscribeMessage("join_conversation")
  async handleJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (socket as any).userId;
    const isMember = await this.chatService.isParticipant(data.conversationId, userId);
    if (!isMember) {
      socket.emit("error", { message: "Not a participant of this conversation" });
      return;
    }
    socket.join(`conv:${data.conversationId}`);
    socket.emit("joined", { conversationId: data.conversationId });
  }

  @SubscribeMessage("leave_conversation")
  handleLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    socket.leave(`conv:${data.conversationId}`);
  }

  // Send a message — persists FIRST, then broadcasts
  @SubscribeMessage("send_message")
  async handleSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; text: string; replyToId?: string },
  ) {
    const senderId = (socket as any).userId;
    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        senderId,
        data.text,
        data.replyToId,
      );
      // Broadcast to all participants in the conversation room
      this.server.to(`conv:${data.conversationId}`).emit("new_message", message);
      return { event: "send_message", data: { success: true, messageId: message.id } };
    } catch (err: any) {
      socket.emit("error", { message: err.message });
    }
  }

  // Typing indicator — does NOT persist, just broadcasts
  @SubscribeMessage("typing_start")
  handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (socket as any).userId;
    socket.to(`conv:${data.conversationId}`).emit("typing", { userId, isTyping: true });
  }

  @SubscribeMessage("typing_stop")
  handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (socket as any).userId;
    socket.to(`conv:${data.conversationId}`).emit("typing", { userId, isTyping: false });
  }

  // Mark messages as read — updates DB, broadcasts read receipt
  @SubscribeMessage("mark_read")
  async handleMarkRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    const userId = (socket as any).userId;
    try {
      await this.chatService.markRead(data.conversationId, userId, data.messageId);
      socket.to(`conv:${data.conversationId}`).emit("messages_read", {
        userId,
        messageId: data.messageId,
      });
    } catch (err: any) {
      socket.emit("error", { message: err.message });
    }
  }

  // Utility: push a notification to a specific user's socket room
  notifyUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
