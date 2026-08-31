import { NotificationsService } from "../src/modules/notifications/notifications.service";
import { NOTIFICATION_TEMPLATES } from "../src/modules/notifications/templates/notification-templates";
import { NotificationEntity, NotificationPreferenceEntity } from "../src/database/entities/notification.entity";
import { NotificationDeliveryAttemptEntity } from "../src/database/entities/logs-delivery.entity";

describe("Notification Engine Checklist Tests", () => {
  let service: NotificationsService;
  let mockNotificationRepo: any;
  let mockPreferenceRepo: any;
  let mockDeliveryRepo: any;
  let mockRealtimeService: any;

  beforeEach(() => {
    mockNotificationRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((n) => Promise.resolve(n)),
      find: jest.fn().mockResolvedValue([]),
    };
    mockPreferenceRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };
    mockDeliveryRepo = {
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      find: jest.fn().mockResolvedValue([]),
    };
    mockRealtimeService = {
      emitToRoom: jest.fn(),
      emitToUser: jest.fn(),
    };

    service = new NotificationsService(
      mockNotificationRepo,
      mockPreferenceRepo,
      mockDeliveryRepo,
      mockRealtimeService
    );
  });

  describe("Multi-Channel Template Engine", () => {
    it("should render appointment_scheduled template with variables across channels", () => {
      const template = service.renderTemplate("appointment_scheduled", {
        patientName: "Hanna Kebede",
        providerName: "Dr. Meron Alemu",
        service: "Doctor Home Visit",
        date: "2026-09-01",
        time: "10:00",
        appointmentId: "apt-101",
      });

      expect(template.title).toBe("Appointment Confirmed");
      expect(template.pushBody).toContain("Dr. Meron Alemu");
      expect(template.smsBody).toContain("apt-101");
      expect(template.emailHtml).toContain("Hanna Kebede");
    });

    it("should render emergency_alert template with urgent warnings", () => {
      const template = service.renderTemplate("emergency_alert", {
        patientName: "Dawit Haile",
        location: "Bole Medhanealem, Addis Ababa",
        phone: "+251911223344",
      });

      expect(template.title).toBe("EMERGENCY DISPATCH ALERT");
      expect(template.smsBody).toContain("MERIHCARE EMERGENCY");
      expect(template.pushBody).toContain("Bole Medhanealem");
    });

    it("should throw error when rendering non-existent template", () => {
      expect(() => service.renderTemplate("unknown_template", {})).toThrow(
        'Template "unknown_template" not found'
      );
    });
  });

  describe("Scheduled Notifications & Preferences", () => {
    it("should schedule a notification item for future dispatch", async () => {
      const scheduleTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const scheduled = await service.scheduleNotification("u-1", scheduleTime, {
        type: "appointment_reminder",
        title: "Reminder",
        body: "Your appointment is tomorrow",
      });

      expect(scheduled.userId).toBe("u-1");
      expect(scheduled.status).toBe("pending");
      expect(scheduled.scheduledFor).toBe(scheduleTime.toISOString());
    });

    it("should update user channel preferences and preserve emergency alerts as active", async () => {
      const updated = await service.updatePreferences("u-1", {
        sms: true,
        email: false,
      });

      expect(updated.sms).toBe(true);
      expect(updated.email).toBe(false);
      expect(updated.emergencyAlerts).toBe(true); // Immutable security invariant
    });
  });
});
