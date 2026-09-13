import { AdminService } from "../src/modules/admin/admin.service";
import { AdminController } from "../src/modules/admin/admin.controller";
import { UserEntity } from "../src/database/entities/user.entity";
import { BadRequestException } from "@nestjs/common";

describe("Administrator Approval Flow Specification", () => {
  let adminService: AdminService;
  let adminController: AdminController;

  const mockUsers: UserEntity[] = [];

  const mockUserRepo: any = {
    find: jest.fn(async ({ where }) => {
      const conditions = Array.isArray(where) ? where : [where];
      return mockUsers.filter((u) => {
        return conditions.some((cond) => {
          for (const key of Object.keys(cond)) {
            if ((u as any)[key] !== cond[key]) return false;
          }
          return true;
        });
      });
    }),
    findOne: jest.fn(async ({ where }) => {
      return mockUsers.find((u) => {
        for (const key of Object.keys(where)) {
          if ((u as any)[key] !== where[key]) return false;
        }
        return true;
      }) || null;
    }),
    save: jest.fn(async (user) => {
      const idx = mockUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        mockUsers[idx] = { ...mockUsers[idx], ...user };
        return mockUsers[idx];
      }
      mockUsers.push(user);
      return user;
    }),
    remove: jest.fn(async (user) => {
      const idx = mockUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        mockUsers.splice(idx, 1);
      }
      return user;
    }),
  };

  const mockNotificationsService: any = {
    sendNotification: jest.fn(async () => ({ id: "notif-1" })),
  };

  const mockRealtimeService: any = {
    emitApprovalRequested: jest.fn(),
    emitToRoom: jest.fn(),
  };

  beforeEach(() => {
    mockUsers.length = 0;
    jest.clearAllMocks();

    adminService = new AdminService(
      mockUserRepo,
      undefined,
      mockNotificationsService,
      mockRealtimeService
    );

    adminController = new AdminController(
      adminService,
      {} as any
    );
  });

  it("should return pending administrators even if email verification is pending", async () => {
    // 1. Pending admin who hasn't verified email/phone OTP yet
    const unverifiedAdmin = new UserEntity();
    unverifiedAdmin.id = "u-admin-pending-1";
    unverifiedAdmin.name = "Selam Admin";
    unverifiedAdmin.email = "selam@merihcare.live";
    unverifiedAdmin.phone = "+251911223344";
    unverifiedAdmin.role = "admin";
    unverifiedAdmin.adminRole = "finance_admin";
    unverifiedAdmin.isApproved = false;
    unverifiedAdmin.emailVerified = false;
    unverifiedAdmin.createdAt = new Date();
    mockUsers.push(unverifiedAdmin);

    // 2. Pending admin who has verified SMS OTP
    const verifiedAdmin = new UserEntity();
    verifiedAdmin.id = "u-admin-pending-2";
    verifiedAdmin.name = "Dawit Admin";
    verifiedAdmin.email = "dawit@merihcare.live";
    verifiedAdmin.phone = "+251922334455";
    verifiedAdmin.role = "admin";
    verifiedAdmin.adminRole = "operations_admin";
    verifiedAdmin.isApproved = false;
    verifiedAdmin.emailVerified = true;
    verifiedAdmin.createdAt = new Date();
    mockUsers.push(verifiedAdmin);

    // 3. Already approved active administrator
    const approvedAdmin = new UserEntity();
    approvedAdmin.id = "u-admin-active";
    approvedAdmin.name = "Active Super Admin";
    approvedAdmin.email = "super@merihcare.live";
    approvedAdmin.role = "admin";
    approvedAdmin.adminRole = "super_admin";
    approvedAdmin.isApproved = true;
    approvedAdmin.emailVerified = true;
    approvedAdmin.createdAt = new Date();
    mockUsers.push(approvedAdmin);

    const pending = await adminService.getPendingAdmins();

    expect(pending.length).toBe(2);
    expect(pending.map((p) => p.id)).toContain("u-admin-pending-1");
    expect(pending.map((p) => p.id)).toContain("u-admin-pending-2");
    expect(pending.map((p) => p.id)).not.toContain("u-admin-active");

    // Formatted department verification
    const selam = pending.find((p) => p.id === "u-admin-pending-1");
    expect(selam.department).toBe("Finance");

    const dawit = pending.find((p) => p.id === "u-admin-pending-2");
    expect(dawit.department).toBe("Operations");
  });

  it("should allow superadmin to approve a pending administrator account and dispatch alerts", async () => {
    const applicant = new UserEntity();
    applicant.id = "u-applicant";
    applicant.name = "Ephrem Admin";
    applicant.email = "ephrem@merihcare.live";
    applicant.phone = "+251933445566";
    applicant.role = "admin";
    applicant.adminRole = "verification_admin";
    applicant.isApproved = false;
    applicant.emailVerified = false;
    mockUsers.push(applicant);

    const result = await adminService.approveAdminAccount("u-superadmin-1", "u-applicant");

    expect(result.isApproved).toBe(true);
    expect(result.status).toBe("active");
    expect(result.emailVerified).toBe(true);
    expect(result.permissions).toBe("all");

    // Verify notification was sent to applicant
    expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
      "u-applicant",
      expect.objectContaining({
        type: "verification_update",
        priority: "critical",
      })
    );

    // Verify realtime events were emitted
    expect(mockRealtimeService.emitToRoom).toHaveBeenCalledWith(
      "admin",
      "user_status_changed",
      expect.objectContaining({ userId: "u-applicant", isApproved: true })
    );
  });

  it("should allow superadmin permissions to access getPendingAdmins endpoint in controller", async () => {
    const applicant = new UserEntity();
    applicant.id = "u-app-ctrl";
    applicant.name = "Hana Admin";
    applicant.email = "hana@merihcare.live";
    applicant.role = "admin";
    applicant.adminRole = "support_admin";
    applicant.isApproved = false;
    mockUsers.push(applicant);

    // Super admin by adminRole
    const reqWithAdminRole = { user: { id: "sa-1", adminRole: "super_admin", role: "admin" } };
    const res1 = await adminController.getPendingAdmins(reqWithAdminRole);
    expect(res1.length).toBe(1);

    // Super admin by role
    const reqWithRole = { user: { id: "sa-2", role: "super_admin" } };
    const res2 = await adminController.getPendingAdmins(reqWithRole);
    expect(res2.length).toBe(1);

    // Super admin by permissions === 'all'
    const reqWithPerms = { user: { id: "sa-3", role: "admin", permissions: "all" } };
    const res3 = await adminController.getPendingAdmins(reqWithPerms);
    expect(res3.length).toBe(1);

    // Non-super admin should be rejected with BadRequestException
    const nonSuper = { user: { id: "op-1", role: "admin", adminRole: "operations_admin" } };
    await expect(adminController.getPendingAdmins(nonSuper)).rejects.toThrow(BadRequestException);
  });
});
