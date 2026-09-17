import { AppointmentsService } from "../src/modules/appointments/appointments.service";
import { RealtimeService } from "../src/modules/realtime/realtime.service";
import { NotificationsService } from "../src/modules/notifications/notifications.service";

describe("Service Request Dispatch & Notification Flow", () => {
  let appointmentsService: AppointmentsService;
  let mockRealtimeService: any;
  let mockNotificationsService: any;
  let mockAppointmentRepo: any;
  let mockHistoryRepo: any;
  let mockCancellationRepo: any;
  let mockDataSource: any;

  let savedAppointments: any[] = [];
  let sentNotifications: any[] = [];
  let emittedRoomEvents: any[] = [];

  const mockAdmins = [
    { id: "admin-1", email: "admin@merihcare.live", role: "admin", adminRole: "super_admin" },
  ];

  const mockActiveProviders = [
    { id: "prov-1", userId: "user-prov-1", name: "Dr. Merih", available: true, status: "verified" },
    { id: "prov-2", userId: "user-prov-2", name: "Nurse Sara", available: true, status: "active" },
  ];

  beforeEach(() => {
    savedAppointments = [];
    sentNotifications = [];
    emittedRoomEvents = [];

    mockAppointmentRepo = {
      find: jest.fn().mockImplementation(() => Promise.resolve(savedAppointments)),
      findOne: jest.fn().mockImplementation(({ where }) => {
        const found = savedAppointments.find((a) => a.id === where.id || (where.id && a.id === where.id));
        return Promise.resolve(found || null);
      }),
      save: jest.fn().mockImplementation((apt) => {
        const existingIdx = savedAppointments.findIndex((a) => a.id === apt.id);
        if (existingIdx >= 0) {
          savedAppointments[existingIdx] = apt;
        } else {
          savedAppointments.push(apt);
        }
        return Promise.resolve(apt);
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockImplementation(() => {
          // Return unassigned + assigned to provider
          return Promise.resolve(savedAppointments);
        }),
      }),
    };

    mockHistoryRepo = {
      save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
    };

    mockCancellationRepo = {
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
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
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockImplementation((entity) => {
            savedAppointments.push(entity);
            return Promise.resolve(entity);
          }),
        };
        return cb(manager);
      }),
      getRepository: jest.fn().mockImplementation((entityClass) => {
        const name = entityClass?.name || "";
        if (name === "UserEntity") {
          return {
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockAdmins),
            }),
            findOne: jest.fn().mockResolvedValue(mockAdmins[0]),
          };
        }
        if (name === "ProviderEntity") {
          return {
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockActiveProviders),
            }),
            findOne: jest.fn().mockImplementation(({ where }) => {
              const targetId = Array.isArray(where) ? where[0]?.id || where[1]?.userId : where.id || where.userId;
              return Promise.resolve(mockActiveProviders.find((p) => p.id === targetId || p.userId === targetId) || null);
            }),
          };
        }
        return {
          findOne: jest.fn().mockResolvedValue(null),
        };
      }),
    };

    appointmentsService = new AppointmentsService(
      mockAppointmentRepo,
      mockHistoryRepo,
      mockCancellationRepo,
      mockDataSource,
      mockRealtimeService,
      mockNotificationsService,
    );
  });

  it("should broadcast to all online providers and create admin persistent notifications on on-demand request", async () => {
    const newRequest = await appointmentsService.createAppointment({
      patientId: "pat-123",
      patientName: "Abebe Bikila",
      service: "Doctor Home Visit",
      date: "2026-09-16",
      time: "14:00",
      location: "Bole Medhanialem, Addis Ababa",
      amount: 800,
      status: "searching",
    });

    expect(newRequest).toBeDefined();
    expect(newRequest.status).toBe("searching");

    // 1. Check that admin room received realtime event
    const adminRoomEvent = emittedRoomEvents.find((e) => e.room === "admin" && e.event === "new_service_request");
    expect(adminRoomEvent).toBeDefined();
    expect(adminRoomEvent.data.patientName).toBe("Abebe Bikila");

    // 2. Check that persistent notification was created for platform admin
    const adminNotification = sentNotifications.find((n) => n.userId === "admin-1");
    expect(adminNotification).toBeDefined();
    expect(adminNotification.type).toBe("new_service_request");
    expect(adminNotification.title).toBe("New Service Request");
    expect(adminNotification.body).toContain("Abebe Bikila");

    // 3. Check that nearby/active providers received realtime events & notifications
    const prov1Notif = sentNotifications.find((n) => n.userId === "user-prov-1");
    const prov2Notif = sentNotifications.find((n) => n.userId === "user-prov-2");
    expect(prov1Notif).toBeDefined();
    expect(prov2Notif).toBeDefined();
    expect(prov1Notif.title).toBe("New Care Request Nearby");

    // 4. Check that provider rooms received websocket event
    const prov1Room = emittedRoomEvents.find((e) => e.room === "provider:user-prov-1");
    expect(prov1Room).toBeDefined();
  });

  it("should auto-assign provider and notify patient when clinician accepts unassigned request", async () => {
    // Initial unassigned appointment in DB
    const apt = {
      id: "apt-ondemand-01",
      patientId: "pat-123",
      patientName: "Abebe Bikila",
      providerId: null,
      providerName: null,
      service: "Physiotherapy Session",
      status: "searching",
      date: "2026-09-16",
      time: "15:00",
      location: "Kazanchis",
      amount: 600,
      createdAt: new Date().toISOString(),
    };
    savedAppointments.push(apt);

    // Clinician accepts the request
    const accepted = await appointmentsService.updateStatus(
      "apt-ondemand-01",
      "accepted",
      "prov-1", // Clinician's providerId
    );

    expect(accepted.status).toBe("accepted");
    expect(accepted.providerId).toBe("prov-1");
    expect(accepted.providerName).toBe("Dr. Merih");

    // Check that patient was notified via WebSocket and in-app notification
    const patientSocketEvent = emittedRoomEvents.find((e) => e.room === "patient:pat-123" && e.event === "provider_response");
    expect(patientSocketEvent).toBeDefined();
    expect(patientSocketEvent.data.status).toBe("accepted");
    expect(patientSocketEvent.data.providerName).toBe("Dr. Merih");

    const patientNotif = sentNotifications.find((n) => n.userId === "pat-123");
    expect(patientNotif).toBeDefined();
    expect(patientNotif.title).toContain("Care Request Accepted");
  });

  it("should filter appointments properly for provider vs admin queries", async () => {
    // Provider query should invoke createQueryBuilder with unassigned + assigned filter
    const provApts = await appointmentsService.getAllAppointments(50, 0, undefined, { role: "provider", id: "user-prov-1" });
    expect(provApts).toBeDefined();
    expect(mockAppointmentRepo.createQueryBuilder).toHaveBeenCalled();

    // Admin query should query all appointments without restriction
    await appointmentsService.getAllAppointments(50, 0, undefined, { role: "admin", id: "admin-1" });
    expect(mockAppointmentRepo.find).toHaveBeenCalled();
  });
});
