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

  describe("Redis Geospatial Radius Detection & OSRM Routing", () => {
    let locationsService: any;
    let mockLocRepo: any;
    let mockHistoryRepo: any;
    let mockRedis: any;

    beforeEach(() => {
      const { LocationsService, setLocationsRedisClientForTesting, resetLocationsRedisClientForTesting } = require("../src/modules/locations/locations.service");
      resetLocationsRedisClientForTesting();

      mockRedis = {
        geoadd: jest.fn().mockResolvedValue(1),
        zrem: jest.fn().mockResolvedValue(1),
        geosearch: jest.fn().mockResolvedValue([
          ["u-prov1", "1.25", ["38.7578", "9.0192"]],
          ["u-prov2", "3.40", ["38.7885", "9.0125"]],
        ]),
        georadius: jest.fn(),
      };

      setLocationsRedisClientForTesting(mockRedis);

      mockLocRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        find: jest.fn().mockResolvedValue([]),
      };

      mockHistoryRepo = {
        save: jest.fn().mockResolvedValue({}),
      };

      locationsService = new LocationsService(mockLocRepo, mockHistoryRepo);
    });

    afterEach(() => {
      const { resetLocationsRedisClientForTesting } = require("../src/modules/locations/locations.service");
      resetLocationsRedisClientForTesting();
    });

    it("should execute Redis GEOADD with longitude preceding latitude when provider updates location", async () => {
      await locationsService.updateLocation("u-prov1", 9.0192, 38.7578);

      expect(mockRedis.geoadd).toHaveBeenCalledWith(
        "providers:locations:online",
        38.7578, // longitude
        9.0192,  // latitude
        "u-prov1",
      );
    });

    it("should execute Redis ZREM when provider goes offline", async () => {
      mockLocRepo.findOne.mockResolvedValue({
        id: "loc-1",
        userId: "u-prov1",
        status: "available",
        x: 38.7578,
        y: 9.0192,
      });

      await locationsService.setStatus("u-prov1", "offline");

      expect(mockRedis.zrem).toHaveBeenCalledWith(
        "providers:locations:online",
        "u-prov1",
      );
    });

    it("should query Redis GEOSEARCH within 5km radius and parse coordinates", async () => {
      const nearby = await locationsService.findNearbyOnlineProviders(9.0222, 38.7468, 5);

      expect(mockRedis.geosearch).toHaveBeenCalledWith(
        "providers:locations:online",
        "FROMLONLAT",
        38.7468,
        9.0222,
        "BYRADIUS",
        5,
        "km",
        "WITHCOORD",
        "WITHDIST",
        "ASC",
      );

      expect(nearby.length).toBe(2);
      expect(nearby[0].providerId).toBe("u-prov1");
      expect(nearby[0].lng).toBe(38.7578);
      expect(nearby[0].lat).toBe(9.0192);
      expect(nearby[0].distanceKm).toBe(1.25);
    });

    it("should pass Redis nearby providers into DispatchCascadeService and sort by OSRM ETA", async () => {
      const mockProvRepo = {
        find: jest.fn().mockResolvedValue([
          {
            id: "prov-2",
            userId: "u-prov2",
            name: "Dr. Farther",
            phone: "+251922222222",
            available: true,
            status: "active",
            verified: true,
            title: "Doctor",
          },
          {
            id: "prov-1",
            userId: "u-prov1",
            name: "Dr. Closer",
            phone: "+251911111111",
            available: true,
            status: "active",
            verified: true,
            title: "Doctor",
          },
        ]),
      };

      const mockDs: any = {
        isInitialized: true,
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity.name === "ProviderEntity") return mockProvRepo;
          return { find: jest.fn().mockResolvedValue([]) };
        }),
      };

      const cascade = new DispatchCascadeService(mockDs, {} as any, undefined, locationsService);
      const candidates = await cascade.findRankedCandidates(9.0222, 38.7468, "Doctor", 5);

      expect(candidates.length).toBe(2);
      expect(candidates[0].name).toBe("Dr. Closer");
      expect(candidates[1].name).toBe("Dr. Farther");
      expect(candidates[0].etaMinutes).toBeLessThanOrEqual(candidates[1].etaMinutes);
      expect(candidates[0].routePoints).toBeDefined();
      expect(candidates[0].geometry).toBeDefined();
    });
  });
});
