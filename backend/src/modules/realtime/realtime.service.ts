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
    this.emitToRoom("admin", "appointment_status_update", {
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

  /** New service request — broadcast to all online providers and admin portal */
  emitNewServiceRequest(data: any) {
    this.emitToRoom("providers", "new_service_request", data);
    this.emitToRoom("admin", "new_service_request", data);
    if (this.server) {
      this.server.emit("new_service_request", {
        v: 1,
        event: "new_service_request",
        data,
        ts: new Date().toISOString(),
      });
    }
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

  /** User removed (deleted) - broadcast immediately to admin room and clients */
  emitUserRemoved(userId: string) {
    const payload = { userId, ts: new Date().toISOString() };
    this.emitToRoom("admin", "user_removed", payload);
    if (this.server) {
      this.server.emit("user_removed", { v: 1, event: "user_removed", data: payload, ts: payload.ts });
    }
  }

  /** User status changed (suspended / active) - broadcast immediately to admin room and clients */
  emitUserStatusChanged(userId: string, status: string) {
    const payload = { userId, status, ts: new Date().toISOString() };
    this.emitToRoom("admin", "user_status_changed", payload);
    if (this.server) {
      this.server.emit("user_status_changed", { v: 1, event: "user_status_changed", data: payload, ts: payload.ts });
    }
  }

  /** New provider or administrator requested approval - broadcast immediately to admin room and clients */
  emitApprovalRequested(data: any) {
    const payload = { ...data, ts: new Date().toISOString() };
    this.emitToRoom("admin", "approval_requested", payload);
    if (this.server) {
      this.server.emit("approval_requested", { v: 1, event: "approval_requested", data: payload, ts: payload.ts });
    }
  }
}
