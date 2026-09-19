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
      markAppointmentNotificationsRead: jest.fn().mockResolvedValue(undefined),
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

  it("should broadcast to the providers room and create admin persistent notifications on on-demand request", async () => {
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

    // 1. Admin room must receive realtime event
    const adminRoomEvent = emittedRoomEvents.find((e) => e.room === "admin" && e.event === "new_service_request");
    expect(adminRoomEvent).toBeDefined();
    expect(adminRoomEvent.data.patientName).toBe("Abebe Bikila");

    // 2. Persistent in-app notification created for platform admin
    const adminNotification = sentNotifications.find((n) => n.userId === "admin-1");
    expect(adminNotification).toBeDefined();
    expect(adminNotification.type).toBe("new_service_request");
    expect(adminNotification.title).toBe("New Service Request");
    expect(adminNotification.body).toContain("Abebe Bikila");

    // 3. "providers" room must receive the broadcast WebSocket event
    //    (replaces the old per-provider DB-scan loop — all online providers are in this room)
    const providersRoomEvent = emittedRoomEvents.find((e) => e.room === "providers" && e.event === "new_service_request");
    expect(providersRoomEvent).toBeDefined();
    expect(providersRoomEvent.data.service).toBe("Doctor Home Visit");

    // 4. A single broadcast in-app notification must be persisted (not per-provider)
    const broadcastNotif = sentNotifications.find((n) => n.userId === "providers_broadcast");
    expect(broadcastNotif).toBeDefined();
    expect(broadcastNotif.title).toBe("New Care Request Nearby");
    expect(broadcastNotif.targetChannel).toBe("in_app");

    // 5. Individual per-provider sendNotification calls must NOT exist for open requests
    //    (they caused O(n) DB queries and spammed unrelated providers)
    const prov1Notif = sentNotifications.find((n) => n.userId === "user-prov-1");
    const prov2Notif = sentNotifications.find((n) => n.userId === "user-prov-2");
    expect(prov1Notif).toBeUndefined();
    expect(prov2Notif).toBeUndefined();
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

  it("should send doctor-specific requests ONLY to that doctor and admin, NOT to all providers or providers room", async () => {
    const directRequest = await appointmentsService.createAppointment({
      patientId: "pat-123",
      patientName: "Tirunesh Dibaba",
      providerId: "prov-1", // Specifically requesting Dr. Merih
      providerName: "Dr. Merih",
      service: "Cardiology Home Visit",
      date: "2026-09-20",
      time: "10:00",
      location: "Bole, Addis Ababa",
      amount: 1200,
      status: "requested",
      notes: "Need direct consultation with Dr. Merih",
    });

    expect(directRequest).toBeDefined();
    expect(directRequest.providerId).toBe("prov-1");

    // 1. Admin room and admin user MUST receive it
    const adminRoomEvent = emittedRoomEvents.find((e) => e.room === "admin" && e.event === "new_service_request");
    expect(adminRoomEvent).toBeDefined();
    const adminNotif = sentNotifications.find((n) => n.userId === "admin-1");
    expect(adminNotif).toBeDefined();

    // 2. Specific requested provider MUST receive it
    const targetProvRoom = emittedRoomEvents.find((e) => e.room === "provider:prov-1" && e.event === "new_service_request");
    expect(targetProvRoom).toBeDefined();
    const targetProvNotif = sentNotifications.find((n) => n.userId === "user-prov-1");
    expect(targetProvNotif).toBeDefined();
    expect(targetProvNotif.title).toBe("New Patient Care Request");

    // 3. MUST NOT broadcast to general "providers" room or global broadcast
    const providersRoomEvent = emittedRoomEvents.find((e) => e.room === "providers");
    expect(providersRoomEvent).toBeUndefined();
    expect(mockRealtimeService.emitNewServiceRequest).not.toHaveBeenCalled();

    // 4. Other providers (prov-2 / user-prov-2) MUST NOT receive notification
    const otherProvNotif = sentNotifications.find((n) => n.userId === "user-prov-2");
    expect(otherProvNotif).toBeUndefined();
  });

  it("should mark notifications read and send completion notification when request is completed", async () => {
    const apt = {
      id: "apt-completed-01",
      patientId: "pat-123",
      patientName: "Abebe Bikila",
      providerId: "prov-1",
      providerName: "Dr. Merih",
      service: "Doctor Home Visit",
      status: "in_progress",
      date: "2026-09-19",
      time: "10:00",
      location: "Bole",
      amount: 800,
      createdAt: new Date().toISOString(),
    };
    savedAppointments.push(apt);

    const completed = await appointmentsService.updateStatus(
      "apt-completed-01",
      "completed",
      "prov-1",
      "Visit completed successfully, vitals normal",
    );

    expect(completed.status).toBe("completed");

    // 1. Notifications related to this appointment must be marked as read
    expect(mockNotificationsService.markAppointmentNotificationsRead).toHaveBeenCalledWith("apt-completed-01");

    // 2. Patient must receive completion notification
    const completedNotif = sentNotifications.find(
      (n) => n.userId === "pat-123" && n.title?.includes("Completed")
    );
    expect(completedNotif).toBeDefined();

    // 3. Realtime status update emitted to appointment and admin rooms
    expect(mockRealtimeService.emitAppointmentUpdate).toHaveBeenCalledWith(
      "apt-completed-01",
      "completed",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("should strictly suppress SMS and Email for on-demand broadcast notifications and use in_app only", async () => {
    // When an on-demand service request is created, the broadcast notification
    // persisted to providers_broadcast must be in_app only (no SMS or Email)
    const req = await appointmentsService.createAppointment({
      patientId: "pat-123",
      patientName: "Kenenisa Bekele",
      service: "Physiotherapy Session",
      location: "Addis Ababa",
      amount: 600,
      status: "searching",
    });

    expect(req).toBeDefined();

    // The broadcast record must use in_app channel (no SMS/Email)
    const broadcastNotif = sentNotifications.find((n) => n.userId === "providers_broadcast");
    expect(broadcastNotif).toBeDefined();
    expect(broadcastNotif.targetChannel).toBe("in_app");
    expect(broadcastNotif.type).toBe("new_service_request");

    // No individual provider should have received a sendNotification call
    // (replaced by room-scoped emitToRoom("providers", ...) which is O(1))
    const perProviderNotifs = sentNotifications.filter((n) => n.userId.startsWith("user-prov-"));
    expect(perProviderNotifs.length).toBe(0);
  });
});
