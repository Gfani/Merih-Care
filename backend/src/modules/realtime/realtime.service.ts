import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

export interface RealtimeEvent {
  v: 1;
  event: string;
  data: any;
  ts: string;
}

@Injectable()
export class RealtimeService {
  private server: Server | null = null;

  /** Called by the gateway after it initializes */
  setServer(server: Server) {
    this.server = server;
  }

  private envelope(event: string, data: any): RealtimeEvent {
    return { v: 1, event, data, ts: new Date().toISOString() };
  }

  /** Emit versioned event to an arbitrary room */
  emitToRoom(room: string, event: string, data: any) {
    if (!this.server) return;
    this.server.to(room).emit(event, this.envelope(event, data));
  }

  /** Emit to a specific user's personal room */
  emitToUser(userId: string, role: "patient" | "provider" | string, event: string, data: any) {
    const room = role === "provider" ? `provider:${userId}` : `patient:${userId}`;
    this.emitToRoom(room, event, data);
  }

  /** Appointment status changed */
  emitAppointmentUpdate(appointmentId: string, status: string, extra: any = {}) {
    this.emitToRoom(`appointment:${appointmentId}`, "appointment_status_update", {
      appointmentId,
      status,
      ...extra,
    });
  }

  /** Emergency created or escalated */
  emitEmergencyAlert(emergencyId: string, data: any) {
    this.emitToRoom(`emergency:${emergencyId}`, "emergency_alert", data);
    this.emitToRoom("admin", "emergency_alert", data); // always notify admin room
  }

  /** New service request — broadcast to all online providers */
  emitNewServiceRequest(data: any) {
    this.emitToRoom("providers", "new_service_request", data);
  }

  /** Provider accepted or rejected a request — notify the patient */
  emitProviderResponse(patientId: string, data: any) {
    this.emitToRoom(`patient:${patientId}`, "provider_response", data);
  }

  /** Push a notification to a user's personal room */
  emitNotification(userId: string, role: string, notification: any) {
    const room = role === "provider" ? `provider:${userId}` : `patient:${userId}`;
    this.emitToRoom(room, "notification", notification);
  }

  /** Admin dashboard live metrics */
  emitAdminMetrics(metrics: Record<string, number>) {
    this.emitToRoom("admin", "admin_metrics", metrics);
  }

  /** User presence status changed */
  emitUserPresence(userId: string, role: string, status: "online" | "offline") {
    this.emitToRoom("admin", "user_presence", { userId, role, status, ts: new Date().toISOString() });
  }

  /** Provider location update for active appointment */
  emitLocationUpdate(appointmentId: string, providerId: string, lat: number, lng: number, ts: string) {
    this.emitToRoom(`appointment:${appointmentId}`, "location_update", {
      appointmentId,
      providerId,
      lat,
      lng,
      ts,
    });
  }

  /** Provider location has gone stale (no update in 90 s) */
  emitLocationStale(appointmentId: string, providerId: string) {
    this.emitToRoom(`appointment:${appointmentId}`, "location_stale", {
      appointmentId,
      providerId,
      ts: new Date().toISOString(),
    });
  }
}
