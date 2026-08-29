import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";

export type AppointmentStatus =
  | "requested"
  | "searching"
  | "accepted"
  | "scheduled"
  | "on_the_way"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "rejected";

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ["searching", "accepted", "cancelled", "rejected"],
  searching: ["accepted", "cancelled", "rejected"],
  accepted: ["on_the_way", "scheduled", "cancelled"],
  scheduled: ["on_the_way", "cancelled"],
  on_the_way: ["arrived", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [], // Terminal
  cancelled: [], // Terminal
  rejected: [],  // Terminal
};

@Injectable()
export class AppointmentPolicyService {
  /**
   * Validate that transitioning from currentStatus to targetStatus is valid
   */
  validateStateTransition(currentStatus: AppointmentStatus, targetStatus: AppointmentStatus, isAdmin = false): void {
    if (isAdmin) return; // Admins can override status transitions

    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid appointment state transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(", ")}]`
      );
    }
  }

  /**
   * Check if two appointment time slots overlap
   */
  checkSlotConflict(
    existingSlot: { date: string; time: string; durationMinutes?: number },
    newSlot: { date: string; time: string; durationMinutes?: number }
  ): void {
    if (existingSlot.date !== newSlot.date) return;

    const parseMinutes = (timeStr: string) => {
      const parts = timeStr.split(":");
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
    };

    const start1 = parseMinutes(existingSlot.time);
    const end1 = start1 + (existingSlot.durationMinutes || 60);

    const start2 = parseMinutes(newSlot.time);
    const end2 = start2 + (newSlot.durationMinutes || 60);

    if (Math.max(start1, start2) < Math.min(end1, end2)) {
      throw new ConflictException(
        `Provider scheduling conflict: An existing appointment already occupies slot ${existingSlot.time} on ${existingSlot.date}.`
      );
    }
  }
}
