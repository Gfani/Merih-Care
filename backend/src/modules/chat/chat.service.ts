import { Injectable } from "@nestjs/common";

@Injectable()
export class ChatService {
  async getChatLogs(roomId: string): Promise<any[]> {
    return [
      { sender: "patient", text: "Hello, what time will you arrive?", timestamp: "10:00" },
      { sender: "provider", text: "Hi! I am on my way, arriving in 15 mins.", timestamp: "10:02" },
    ];
  }
}
