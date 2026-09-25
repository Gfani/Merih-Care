export enum Permission {
  USERS_READ = "users:read",
  USERS_WRITE = "users:write",
  USERS_DELETE = "users:delete",
  ADMINS_READ = "admins:read",
  ADMINS_WRITE = "admins:write",
  ADMINS_DELETE = "admins:delete",
  CREDENTIALS_REVIEW = "credentials:review",
  CREDENTIALS_APPROVE = "credentials:approve",
  FINANCIAL_READ = "financial:read",
  FINANCIAL_PAYOUT = "financial:payout",
  FINANCIAL_REFUND = "financial:refund",
  SETTINGS_READ = "settings:read",
  SETTINGS_WRITE = "settings:write",
  AUDIT_READ = "audit:read",
  REPORTS_READ = "reports:read",
  COMPLAINTS_READ = "complaints:read",
  COMPLAINTS_WRITE = "complaints:write",
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: Object.values(Permission),
  super_admin: Object.values(Permission),
  operations_admin: [
    Permission.USERS_READ,
    Permission.USERS_WRITE,
    Permission.REPORTS_READ,
    Permission.COMPLAINTS_READ,
    Permission.COMPLAINTS_WRITE,
    Permission.AUDIT_READ,
  ],
  verification_admin: [
    Permission.USERS_READ,
    Permission.CREDENTIALS_REVIEW,
    Permission.CREDENTIALS_APPROVE,
    Permission.REPORTS_READ,
  ],
  verifier: [
    Permission.USERS_READ,
    Permission.CREDENTIALS_REVIEW,
    Permission.CREDENTIALS_APPROVE,
  ],
  finance_admin: [
    Permission.FINANCIAL_READ,
    Permission.FINANCIAL_PAYOUT,
    Permission.FINANCIAL_REFUND,
    Permission.REPORTS_READ,
  ],
  support_admin: [
    Permission.USERS_READ,
    Permission.COMPLAINTS_READ,
    Permission.COMPLAINTS_WRITE,
  ],
  admin: [
    Permission.USERS_READ,
    Permission.REPORTS_READ,
    Permission.COMPLAINTS_READ,
    Permission.AUDIT_READ,
  ],
};

export function getEffectivePermissions(user: any): string[] {
  if (!user) return [];

  const ownerEmail = (process.env.OWNER_EMAIL || "owner@merihcare.et").toLowerCase().trim();
  const isOwner =
    user.role === "owner" ||
    user.adminRole === "owner" ||
    (user.email && user.email.toLowerCase().trim() === ownerEmail);
  if (isOwner) {
    return Object.values(Permission);
  }

  const permissionsSet = new Set<string>();

  // Explicit user.permissions
  if (user.permissions) {
    if (typeof user.permissions === "string") {
      if (user.permissions === "all") {
        if (user.adminRole === "super_admin" || user.role === "super_admin" || isOwner) {
          return Object.values(Permission);
        }
      } else {
        user.permissions.split(",").map((p: string) => p.trim()).filter(Boolean).forEach((p: string) => permissionsSet.add(p));
      }
    } else if (Array.isArray(user.permissions)) {
      user.permissions.forEach((p: string) => permissionsSet.add(p));
    }
  }

  // Derive from granular adminRole or user.role
  const rolesToInspect = [user.adminRole, user.role].filter(Boolean);
  for (const r of rolesToInspect) {
    const rolePerms = ROLE_PERMISSIONS[r];
    if (rolePerms) {
      rolePerms.forEach((p) => permissionsSet.add(p));
    }
  }

  return Array.from(permissionsSet);
}
