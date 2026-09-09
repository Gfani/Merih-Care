import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import { ShieldAlert } from "lucide-react";
import { Button } from "./ui";

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const location = useLocation();

  const isAuthed = isAuthenticated || !!localStorage.getItem("admin_token");

  if (!isAuthed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isSuperAdminEmail =
    user?.email === "fanuelgoitom79@gmail.com" ||
    user?.email === "fani@g.com" ||
    user?.email === "admin@merihcare.et";

  const isAnyAdmin =
    isSuperAdminEmail ||
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    !!(user as any)?.adminRole ||
    String(user?.role).includes("admin");

  if (allowedRoles && !isAnyAdmin && !hasPermission(allowedRoles)) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center mt-12 bg-white rounded-[16px] border border-[#e2e8ee] shadow-sm">
        <div className="w-14 h-14 bg-[#fee2e2] text-[#dc2626] rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-[#18232e] mb-2">Access Restricted</h2>
        <p className="text-sm text-[#4a5a6a] mb-6">
          Your administrative account does not possess the permissions required to view this module.
        </p>
        <Button onClick={() => window.history.back()} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return children;
}
