import { ForbiddenException } from "@nestjs/common";
import { DispatchCascadeService } from "../src/modules/appointments/dispatch-cascade.service";
import { ChatService } from "../src/modules/chat/chat.service";

describe("Temporary Lifecycle-Bound Messaging & Proximity Dispatch Cascade", () => {
  describe("Chat Lifecycle Guard", () => {
    let chatService: ChatService;
    let mockDataSource: any;
    let mockParticipantRepo: any;
    let mockConversationRepo: any;
    let mockMessageRepo: any;
    let mockAppointmentRepo: any;

    beforeEach(() => {
      mockParticipantRepo = {
        findOne: jest.fn().mockResolvedValue({ id: "part-1", userId: "user-1", isBlocked: false, role: "member" }),
      };
      mockConversationRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "conv-1",
          appointmentId: "apt-1",
          isProtected: false,
        }),
        save: jest.fn().mockResolvedValue({}),
      };
      mockMessageRepo = {
        save: jest.fn().mockImplementation((msg) => Promise.resolve(msg)),
        find: jest.fn().mockResolvedValue([]),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAppointmentRepo = {
        findOne: jest.fn(),
      };
      mockDataSource = {
        isInitialized: true,
        getRepository: jest.fn().mockReturnValue(mockAppointmentRepo),
      };

      chatService = new ChatService(
        mockConversationRepo,
        mockParticipantRepo,
        mockMessageRepo,
        {} as any,
        {} as any,
        {} as any,
        mockDataSource,
      );
    });

    it("should allow sending message when appointment status is actively ongoing (e.g. accepted)", async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: "apt-1",
        status: "accepted",
      });

      const message = await chatService.sendMessage("conv-1", "user-1", "Hello Dr.");
      expect(message).toBeDefined();
      expect(message.text).toBe("Hello Dr.");
      expect(mockMessageRepo.save).toHaveBeenCalled();
    });

    it("should reject sending message with CHAT_SESSION_CLOSED error when appointment status is completed", async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: "apt-1",
        status: "completed",
      });

      await expect(chatService.sendMessage("conv-1", "user-1", "Are you still here?")).rejects.toThrow(
        ForbiddenException,
      );

      try {
        await chatService.sendMessage("conv-1", "user-1", "Are you still here?");
      } catch (err: any) {
        expect(err.code || err.response?.errorCode).toBe("CHAT_SESSION_CLOSED");
        expect(err.readOnly || err.response?.readOnly).toBe(true);
      }
    });

    it("should reject sending message with CHAT_SESSION_CLOSED error when appointment status is cancelled", async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: "apt-1",
        status: "cancelled",
      });

      await expect(chatService.sendMessage("conv-1", "user-1", "Why did you cancel?")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should return readOnly: true and isClosed: true in getMessages for closed session", async () => {
      mockAppointmentRepo.findOne.mockResolvedValue({
        id: "apt-1",
        status: "completed",
      });

      const res = await chatService.getMessages("conv-1", "user-1");
      expect(res.isClosed).toBe(true);
      expect(res.readOnly).toBe(true);
      expect(res.appointmentStatus).toBe("completed");
    });
  });

  describe("DispatchCascadeService", () => {
    let cascadeService: DispatchCascadeService;
    let mockDataSource: any;
    let mockRealtimeService: any;
    let mockChatService: any;
    let mockProvRepo: any;
    let mockLocRepo: any;
    let mockAptRepo: any;

    beforeEach(() => {
      mockProvRepo = {
        find: jest.fn().mockResolvedValue([
          {
            id: "prov-far",
            userId: "u-far",
            name: "Dr. Far",
            phone: "+251911111111",
            latitude: 9.08,
            longitude: 38.78,
            available: true,
            status: "active",
            verified: true,
            title: "Doctor",
          },
          {
            id: "prov-near",
            userId: "u-near",
            name: "Dr. Near",
            phone: "+251922222222",
            latitude: 9.03,
            longitude: 38.75,
            available: true,
            status: "active",
            verified: true,
            title: "Doctor",
          },
        ]),
      };
      mockLocRepo = {
        find: jest.fn().mockResolvedValue([]),
      };
      mockAptRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: "apt-ondemand",
          patientId: "pat-1",
          patientName: "Abebe",
          status: "requested",
          service: "Doctor Home Visit",
          amount: 500,
        }),
        save: jest.fn().mockImplementation((a) => Promise.resolve(a)),
      };

      mockDataSource = {
        isInitialized: true,
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity.name === "ProviderEntity") return mockProvRepo;
          if (entity.name === "LocationEntity") return mockLocRepo;
          if (entity.name === "AppointmentEntity") return mockAptRepo;
          return { save: jest.fn().mockResolvedValue({}) };
        }),
      };

      mockRealtimeService = {
        emitToRoom: jest.fn(),
        emitAppointmentUpdate: jest.fn(),
      };

      mockChatService = {
        createConversation: jest.fn().mockResolvedValue({ id: "conv-lifecycle-1" }),
      };

      cascadeService = new DispatchCascadeService(
        mockDataSource,
        mockRealtimeService,
        mockChatService,
      );
    });

    it("should rank candidate providers in ascending order by ETA (closest clinician first)", async () => {
      // Patient at Bole: 9.0222, 38.7468
      const candidates = await cascadeService.findRankedCandidates(9.0222, 38.7468, "Doctor Home Visit", 15);
      expect(candidates.length).toBe(2);
      expect(candidates[0].name).toBe("Dr. Near");
      expect(candidates[1].name).toBe("Dr. Far");
      expect(candidates[0].etaMinutes).toBeLessThan(candidates[1].etaMinutes);
    });

    it("should send service_offer event to top-ranked candidate and set 30s timer", async () => {
      const apt: any = {
        id: "apt-ondemand",
        patientId: "pat-1",
        patientName: "Abebe",
        service: "Doctor Home Visit",
        location: "Bole Road",
        amount: 500,
      };

      const session = await cascadeService.startCascade(apt, 9.0222, 38.7468, 15);
      expect(session).toBeDefined();
      expect(session?.currentIndex).toBe(0);
      expect(session?.candidates[0].name).toBe("Dr. Near");

      // Verify WebSocket service_offer emission to top provider
      expect(mockRealtimeService.emitToRoom).toHaveBeenCalledWith(
        "provider:u-near",
        "service_offer",
        expect.objectContaining({
          appointmentId: "apt-ondemand",
          patientName: "Abebe",
          timeoutSeconds: 30,
        }),
      );

      // Clean up timers
      cascadeService.cancelCascade("apt-ondemand");
    });

    it("should cascade offer to candidate #1 when candidate #0 declines", async () => {
      const apt: any = {
        id: "apt-ondemand",
        patientId: "pat-1",
        patientName: "Abebe",
        service: "Doctor Home Visit",
        location: "Bole Road",
        amount: 500,
      };

      await cascadeService.startCascade(apt, 9.0222, 38.7468, 15);

      // Provider 0 declines
      await cascadeService.handleDecline("apt-ondemand", "u-near");

      // Verify offer dispatched to next candidate
      expect(mockRealtimeService.emitToRoom).toHaveBeenCalledWith(
        "provider:u-far",
        "service_offer",
        expect.objectContaining({
          appointmentId: "apt-ondemand",
          cascadeIndex: 1,
        }),
      );

      cascadeService.cancelCascade("apt-ondemand");
    });

    it("should transition appointment to accepted and auto-create conversation when clinician accepts", async () => {
      const apt: any = {
        id: "apt-ondemand",
        patientId: "pat-1",
        patientName: "Abebe",
        service: "Doctor Home Visit",
        location: "Bole Road",
        amount: 500,
      };

      await cascadeService.startCascade(apt, 9.0222, 38.7468, 15);

      const result = await cascadeService.handleAccept("apt-ondemand", "u-near");
      expect(result.success).toBe(true);
      expect(mockAptRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "accepted",
          providerId: "prov-near",
        }),
      );

      // Auto-created lifecycle conversation between patient and accepted doctor
      expect(mockChatService.createConversation).toHaveBeenCalledWith(
        ["pat-1", "u-near"],
        "apt-ondemand",
        false,
      );

      // Emitted offer_accepted and appointment_status_update
      expect(mockRealtimeService.emitToRoom).toHaveBeenCalledWith(
        "provider:u-near",
        "offer_accepted",
        expect.objectContaining({
          status: "accepted",
          conversationId: "conv-lifecycle-1",
        }),
      );
    });
  });
});
