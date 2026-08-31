import { LocationsService } from "../src/modules/locations/locations.service";
import { LocationEntity } from "../src/database/entities/location.entity";

describe("Map, Location & Route Checklist Tests", () => {
  let service: LocationsService;
  let mockLocationRepo: any;
  let mockHistoryRepo: any;

  beforeEach(() => {
    mockLocationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((l) => Promise.resolve(l)),
    };
    mockHistoryRepo = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
    };

    service = new LocationsService(mockLocationRepo, mockHistoryRepo);
  });

  describe("Provider Privacy Mode Fuzzing", () => {
    it("should mask coordinates to neighborhood level when privacyMode is active", async () => {
      const loc = new LocationEntity();
      loc.id = "loc-1";
      loc.role = "provider";
      loc.privacyMode = true;
      loc.x = 38.757829;
      loc.y = 9.019284;
      mockLocationRepo.find.mockResolvedValue([loc]);

      const result = await service.getAllLocations();
      expect(result[0].x).toBe(38.76);
      expect(result[0].y).toBe(9.02);
    });

    it("should hide coordinates when provider is offline", async () => {
      const loc = new LocationEntity();
      loc.id = "loc-2";
      loc.role = "provider";
      loc.status = "offline";
      loc.x = 38.75;
      loc.y = 9.02;
      mockLocationRepo.find.mockResolvedValue([loc]);

      const result = await service.getAllLocations();
      expect(result[0].x).toBe(0);
      expect(result[0].y).toBe(0);
    });
  });

  describe("Geofence Arrival Detection", () => {
    it("should detect arrival when provider is within 100 meters of destination", () => {
      // 9.019200, 38.757800 to 9.019250, 38.757850 (~8 meters apart)
      const result = service.checkGeofenceArrival(9.0192, 38.7578, 9.01925, 38.75785, 100);
      expect(result.isWithinGeofence).toBe(true);
      expect(result.distanceMeters).toBeLessThan(50);
    });

    it("should report outside geofence when distance exceeds threshold", () => {
      // Bole to Piazza (~5.5 km)
      const result = service.checkGeofenceArrival(8.9806, 38.7578, 9.035, 38.752, 100);
      expect(result.isWithinGeofence).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(1000);
    });
  });

  describe("Route Distance & ETA Estimation", () => {
    it("should calculate travel distance and traffic-adjusted ETA in Addis Ababa", () => {
      const route = service.calculateDistanceAndEta(9.0192, 38.7578, 9.035, 38.752);
      expect(route.distance).toContain("km");
      expect(route.eta).toBeGreaterThan(0);
    });
  });

  describe("Emergency Overlays", () => {
    it("should retrieve critical emergency pins for map overlay", async () => {
      const criticalLoc = new LocationEntity();
      criticalLoc.id = "loc-emg-1";
      criticalLoc.userId = "pat-1";
      criticalLoc.status = "critical";
      criticalLoc.x = 38.75;
      criticalLoc.y = 9.02;
      mockLocationRepo.find.mockResolvedValue([criticalLoc]);

      const overlays = await service.getEmergencyOverlays();
      expect(overlays).toHaveLength(1);
      expect(overlays[0].severity).toBe("critical");
    });
  });
});
