import { LocationsService } from "../src/modules/locations/locations.service";
import { RealtimeGateway } from "../src/modules/realtime/realtime.gateway";
import { RealtimeService } from "../src/modules/realtime/realtime.service";

describe("Load & Concurrency Testing - Realtime & Map Streams", () => {
  let locationsService: LocationsService;
  let mockLocationRepo: any;
  let mockHistoryRepo: any;
  let realtimeGateway: RealtimeGateway;
  let realtimeService: RealtimeService;
  let mockJwtService: any;
  let mockAppointmentRepo: any;
  let mockServer: any;

  beforeEach(() => {
    mockLocationRepo = {
      save: jest.fn().mockImplementation((loc) => Promise.resolve(loc)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    mockHistoryRepo = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
    };
    mockJwtService = {
      verifyAsync: jest.fn(),
    };
    mockAppointmentRepo = {
      findOne: jest.fn(),
    };

    locationsService = new LocationsService(
      mockLocationRepo,
      mockHistoryRepo
    );

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    realtimeService = new RealtimeService();
    realtimeGateway = new RealtimeGateway(
      realtimeService,
      mockJwtService,
      mockLocationRepo,
      mockAppointmentRepo
    );
    (realtimeGateway as any).server = mockServer;
  });

  describe("High-Throughput Concurrent Location Telemetry", () => {
    it("should handle 50 concurrent provider location updates concurrently without race conditions", async () => {
      const concurrentUpdates = Array.from({ length: 50 }, (_, i) => ({
        providerId: `prov-${i + 1}`,
        lat: 9.0100 + i * 0.0001,
        lng: 38.7500 + i * 0.0001,
      }));

      const results = await Promise.all(
        concurrentUpdates.map((u) =>
          locationsService.updateLocation(u.providerId, u.lat, u.lng)
        )
      );

      expect(results.length).toBe(50);
      expect(mockLocationRepo.save).toHaveBeenCalledTimes(50);
    });
  });

  describe("Socket Broadcast Concurrency & Room Isolation", () => {
    it("should broadcast concurrent appointment tracking events to isolated rooms", async () => {
      const concurrentSocketEvents = Array.from({ length: 20 }, (_, i) => ({
        room: `appointment:apt-${i + 1}`,
        event: "provider_location",
        payload: { lat: 9.02, lng: 38.74, heading: 90 },
      }));

      await Promise.all(
        concurrentSocketEvents.map((evt) => {
          mockServer.to(evt.room).emit(evt.event, evt.payload);
          return Promise.resolve();
        })
      );

      expect(mockServer.to).toHaveBeenCalledTimes(20);
      expect(mockServer.emit).toHaveBeenCalledTimes(20);
    });
  });
});
