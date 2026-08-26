import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Missing authentication context");
    }

    // Admins bypass ownership checks
    if (user.role === "admin") {
      return true;
    }

    const { id, patientId, providerId, appointmentId, roomId } = request.params;

    // 1. User Profile Ownership checks
    if (id && id === user.id) {
      return true;
    }

    // 2. Patient Parameter checks
    if (patientId && patientId !== user.id && user.role === "patient") {
      return false;
    }

    // 3. Provider Parameter checks
    if (providerId && providerId !== user.id && user.role === "provider") {
      return false;
    }

    // 4. Appointment Ownership checks
    if (appointmentId) {
      try {
        const aptRepo = this.dataSource.getRepository("AppointmentEntity");
        const apt: any = await aptRepo.findOne({ where: { id: appointmentId } });
        if (apt) {
          if (apt.patientId === user.id || apt.providerId === user.id) {
            return true;
          }
          return false;
        }
      } catch (e) {
        console.error("OwnershipGuard appointment query failed: ", e);
      }
    }

    // 5. Chat Room Ownership checks
    if (roomId) {
      if (roomId.includes(user.id)) {
        return true;
      }
      return false;
    }

    return true;
  }
}
