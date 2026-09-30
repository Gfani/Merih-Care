import { DispatchCascadeService } from "../src/modules/appointments/dispatch-cascade.service";
import { AppointmentsService } from "../src/modules/appointments/appointments.service";
import { AppointmentEntity } from "../src/database/entities/appointment.entity";
import { ProviderEntity } from "../src/database/entities/provider.entity";
import { LocationEntity } from "../src/database/entities/location.entity";

describe("Yango/Uber-Style Automatic Cascade Dispatch Engine", () => {
  let dispatchCascadeService: DispatchCascadeService;
  let appointmentsService: AppointmentsService;
  let mockRealtimeService: any;
  let mockNotificationsService: any;
  let mockDataSource: any;
  let mockAppointmentRepo: any;
  let mockHistoryRepo: any;
  let mockCancellationRepo: any;
  let mockProviderRepo: any;
  let mockLocationRepo: any;

  let savedAppointments: any[] = [];
  let savedHistory: any[] = [];
  let emittedRoomEvents: any[] = [];
  let sentNotifications: any[] = [];

  const candidateProviders = [
    {
      id: "prov-1",
      userId: "user-prov-1",
      name: "Dr. Kebede (Closest - 1.2km)",
      phone: "+251911111111",
      specialty: "Doctor Home Visit",
      available: true,
      status: "active",
      verified: true,
      latitude: 9.025,
      longitude: 38.748,
    },
    {
      id: "prov-2",
      userId: "user-prov-2",
      name: "Dr. Almaz (Second closest - 2.8km)",
      phone: "+251922222222",
      specialty: "Doctor Home Visit",
      available: true,
      status: "active",
      verified: true,
      latitude: 9.035,
      longitude: 38.755,
    },
    {
      id: "prov-3",
      userId: "user-prov-3",
      name: "Dr. Solomon (Third closest - 4.5km)",
      phone: "+251933333333",
      specialty: "Doctor Home Visit",
      available: true,
      status: "active",
      verified: true,
      latitude: 9.045,
      longitude: 38.765,
    },
  ];

  beforeEach(() => {
    savedAppointments = [];
    savedHistory = [];
    emittedRoomEvents = [];
    sentNotifications = [];

    mockAppointmentRepo = {
      find: jest.fn().mockImplementation(() => Promise.resolve(savedAppointments)),
      findOne: jest.fn().mockImplementation(({ where }) => {
        const found = savedAppointments.find((a) => a.id === where.id);
        return Promise.resolve(found ? { ...found } : null);
      }),
      save: jest.fn().mockImplementation((apt) => {
        const idx = savedAppointments.findIndex((a) => a.id === apt.id);
        if (idx >= 0) {
          savedAppointments[idx] = { ...savedAppointments[idx], ...apt };
        } else {
          savedAppointments.push({ ...apt });
        }
        return Promise.resolve(apt);
      }),
    };

    mockHistoryRepo = {
      save: jest.fn().mockImplementation((h) => {
        savedHistory.push(h);
        return Promise.resolve(h);
      }),
    };

    mockCancellationRepo = {
      save: jest.fn().mockResolvedValue({}),
    };

    mockProviderRepo = {
      find: jest.fn().mockResolvedValue(candidateProviders),
      findOne: jest.fn().mockImplementation(({ where }) => {
        const id = Array.isArray(where) ? where[0]?.id : where?.id;
        const p = candidateProviders.find((cp) => cp.id === id || cp.userId === id);
        return Promise.resolve(p ? { ...p } : null);
      }),
    };

    mockLocationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    mockDataSource = {
      isInitialized: true,
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === AppointmentEntity) return mockAppointmentRepo;
        if (entity === ProviderEntity) return mockProviderRepo;
        if (entity === LocationEntity) return mockLocationRepo;
        return mockHistoryRepo;
      }),
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          findOne: mockAppointmentRepo.findOne,
          save: mockAppointmentRepo.save,
        };
        return cb(manager);
      }),
    };

    mockRealtimeService = {
      emitNewServiceRequest: jest.fn().mockImplementation((data) => {
        emittedRoomEvents.push({ room: "broadcast", event: "new_service_request", data });
      }),
      emitAppointmentUpdate: jest.fn().mockImplementation((id, status, data) => {
        emittedRoomEvents.push({ room: `appointment:${id}`, event: "appointment_status_update", status, data });
      }),
      emitToRoom: jest.fn().mockImplementation((room, event, data) => {
        emittedRoomEvents.push({ room, event, data });
      }),
      emitProviderResponse: jest.fn().mockImplementation((patientId, data) => {
        emittedRoomEvents.push({ room: `patient:${patientId}`, event: "provider_response", data });
      }),
    };

    mockNotificationsService = {
      sendNotification: jest.fn().mockImplementation((userId, opts) => {
        sentNotifications.push({ userId, ...opts });
        return Promise.resolve({ id: `notif-${Date.now()}`, userId, ...opts });
      }),
      markAppointmentNotificationsRead: jest.fn().mockResolvedValue(undefined),
    };

    dispatchCascadeService = new DispatchCascadeService(
      mockDataSource,
      mockRealtimeService,
      undefined,
      undefined,
      mockNotificationsService,
    );

    appointmentsService = new AppointmentsService(
      mockAppointmentRepo,
      mockHistoryRepo,
      mockCancellationRepo,
      mockDataSource,
      mockRealtimeService,
      mockNotificationsService,
      dispatchCascadeService,
    );
  });

  afterEach(() => {
    ["apt-test-1", "apt-cascade-1", "apt-timeout-1", "apt-exhaust-1", "apt-cancel-1"].forEach((id) => {
      dispatchCascadeService.cancelCascade(id);
    });
  });

  describe("1. Nearest-Neighbor Dispatch and Rejection Cascade Flow", () => {
    it("should send the initial offer to the #1 closest provider with 30s timeout", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-test-1";
      apt.patientId = "pat-123";
      apt.patientName = "Abebe Bikila";
      apt.service = "Doctor Home Visit";
      apt.status = "searching";
      apt.amount = 450;
      apt.latitude = 9.022;
      apt.longitude = 38.746;
      savedAppointments.push(apt);

      const session = await dispatchCascadeService.startCascade(apt, 9.022, 38.746, 5);
      expect(session).toBeDefined();
      expect(session?.candidates.length).toBe(3);
      expect(session?.candidates[0].providerId).toBe("prov-1"); // Closest

      // Check emitted event to provider #1
      const offerEvents = emittedRoomEvents.filter(
        (e) => e.room === "provider:user-prov-1" && e.event === "service_offer",
      );
      expect(offerEvents.length).toBeGreaterThanOrEqual(1);
      expect(offerEvents[0].data.timeoutSeconds).toBe(30);
      expect(offerEvents[0].data.providerId).toBe("prov-1");
    });

    it("should NOT cancel appointment when provider calls rejectAppointment; should set searching and cascade to #2 doctor", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-cascade-1";
      apt.patientId = "pat-123";
      apt.patientName = "Tadesse Chala";
      apt.service = "Doctor Home Visit";
      apt.status = "searching";
      apt.amount = 500;
      apt.latitude = 9.022;
      apt.longitude = 38.746;
      apt.excludedProviders = [];
      savedAppointments.push(apt);

      await dispatchCascadeService.startCascade(apt, 9.022, 38.746, 5);

      // Provider #1 declines
      const updatedApt = await appointmentsService.rejectAppointment("apt-cascade-1", "prov-1", "Busy with patient");

      // Critical requirement: status MUST NOT be 'cancelled'
      expect(updatedApt.status).toBe("searching");
      expect(updatedApt.status).not.toBe("cancelled");
      expect(updatedApt.excludedProviders).toContain("prov-1");

      // Provider #1 should receive offer_cancelled
      const cancelEvents = emittedRoomEvents.filter(
        (e) => e.room === "provider:prov-1" && e.event === "offer_cancelled",
      );
      expect(cancelEvents.length).toBeGreaterThanOrEqual(1);

      // Provider #2 (next nearest doctor) should receive the next service_offer!
      const offerEventsDoctor2 = emittedRoomEvents.filter(
        (e) => e.room === "provider:user-prov-2" && e.event === "service_offer",
      );
      expect(offerEventsDoctor2.length).toBeGreaterThanOrEqual(1);
      expect(offerEventsDoctor2[0].data.providerId).toBe("prov-2");
    });

    it("should filter out excluded_providers on nearest-neighbor search", async () => {
      const excluded = new Set(["prov-1"]);
      const candidates = await dispatchCascadeService.findRankedCandidates(9.022, 38.746, "Doctor Home Visit", 5, excluded);

      expect(candidates.some((c) => c.providerId === "prov-1")).toBe(false);
      expect(candidates[0].providerId).toBe("prov-2");
    });
  });

  describe("2. 30-Second Offer Timeout Handling", () => {
    it("should cascade to next clinician when active offer 30-second timer expires", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-timeout-1";
      apt.patientId = "pat-123";
      apt.patientName = "Sara T.";
      apt.service = "Doctor Home Visit";
      apt.status = "searching";
      apt.amount = 400;
      apt.latitude = 9.022;
      apt.longitude = 38.746;
      savedAppointments.push(apt);

      await dispatchCascadeService.startCascade(apt, 9.022, 38.746, 5);

      // Simulate 30s timer expiration on candidate #1
      await dispatchCascadeService.handleTimeout("apt-timeout-1", "user-prov-1", "prov-1");

      const session = dispatchCascadeService.getSession("apt-timeout-1");
      expect(session?.excludedProviders.has("prov-1")).toBe(true);

      // Provider #1 notified of expiration
      const expiredEvents = emittedRoomEvents.filter(
        (e) => e.room === "provider:user-prov-1" && e.event === "offer_expired",
      );
      expect(expiredEvents.length).toBe(1);

      // Provider #2 receives next offer
      const offerEventsDoctor2 = emittedRoomEvents.filter(
        (e) => e.room === "provider:user-prov-2" && e.event === "service_offer",
      );
      expect(offerEventsDoctor2.length).toBe(1);
    });
  });

  describe("3. Terminal States (Exhaustion & Manual Cancellation)", () => {
    it("should notify patient 'No doctors available nearby right now, searching again...' when all candidates are exhausted", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-exhaust-1";
      apt.patientId = "pat-999";
      apt.patientName = "Hanna M.";
      apt.service = "Doctor Home Visit";
      apt.status = "searching";
      apt.amount = 400;
      apt.latitude = 9.022;
      apt.longitude = 38.746;
      savedAppointments.push(apt);

      await dispatchCascadeService.startCascade(apt, 9.022, 38.746, 5);

      // Doctor 1 rejects
      await dispatchCascadeService.handleReject("apt-exhaust-1", "prov-1");
      // Doctor 2 rejects
      await dispatchCascadeService.handleReject("apt-exhaust-1", "prov-2");
      // Doctor 3 rejects (last candidate)
      await dispatchCascadeService.handleReject("apt-exhaust-1", "prov-3");

      // Verify terminal state notification sent to patient
      const patientNotifications = emittedRoomEvents.filter(
        (e) => e.room === "patient:pat-999" && (e.event === "dispatch_cascade_exhausted" || e.event === "dispatch_update"),
      );
      expect(patientNotifications.length).toBeGreaterThan(0);
      const exhaustMsg = patientNotifications.find((e) => e.data?.message?.includes("No doctors available nearby right now"));
      expect(exhaustMsg).toBeDefined();

      // Crucial: Appointment status MUST NOT be cancelled!
      const currentApt = savedAppointments.find((a) => a.id === "apt-exhaust-1");
      expect(currentApt.status).not.toBe("cancelled");
      expect(currentApt.status).toBe("searching");
    });

    it("should ONLY mark cancelled when patient explicitly cancels", async () => {
      const apt = new AppointmentEntity();
      apt.id = "apt-cancel-1";
      apt.patientId = "pat-777";
      apt.patientName = "Patient Cancel";
      apt.service = "Doctor Home Visit";
      apt.status = "searching";
      apt.amount = 400;
      apt.latitude = 9.022;
      apt.longitude = 38.746;
      savedAppointments.push(apt);

      await dispatchCascadeService.startCascade(apt, 9.022, 38.746, 5);

      // Patient cancels explicitly
      const cancelledApt = await appointmentsService.cancelAppointment("apt-cancel-1", "Patient no longer needs care", "pat-777");
      expect(cancelledApt.status).toBe("cancelled");
      expect(cancelledApt.cancelledBy).toBe("pat-777");

      // Session should be cancelled
      const session = dispatchCascadeService.getSession("apt-cancel-1");
      expect(session).toBeUndefined();
    });
  });
});
