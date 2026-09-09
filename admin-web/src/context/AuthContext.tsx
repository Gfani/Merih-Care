import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../services/api";
import { User, UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  googleLogin: (idToken?: string) => Promise<void>;
  logout: () => void;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("admin_user");
    if (!raw || raw === "undefined" || raw === "null") return null;
    try {
      const parsed = JSON.parse(raw);
      const emailLower = (parsed?.email || "").toLowerCase().trim();
      if (parsed && (emailLower === "fanuelgoitom79@gmail.com" || emailLower === "fani@g.com" || emailLower === "admin@merihcare.et")) {
        parsed.role = "admin";
        parsed.adminRole = "super_admin";
      }
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener("merihcare:session_expired", handleSessionExpired);
    return () => window.removeEventListener("merihcare:session_expired", handleSessionExpired);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    const emailLower = (res.user?.email || "").toLowerCase().trim();
    if (res.user && (emailLower === "fanuelgoitom79@gmail.com" || emailLower === "fani@g.com" || emailLower === "admin@merihcare.et")) {
      res.user.role = "admin";
      res.user.adminRole = "super_admin";
      localStorage.setItem("admin_user", JSON.stringify(res.user));
    }
    setToken(res.access_token);
    setUser(res.user);
  };

  const googleLogin = async (idToken?: string) => {
    if (!idToken) {
      throw new Error("Google Sign-In is not currently enabled for this domain or no Google credential was received. Please sign in using your administrator email and password.");
    }
    const res = await api.googleAuth(idToken, "admin");
    if (res.access_token) {
      const emailLower = (res.user?.email || "").toLowerCase().trim();
      if (res.user && (emailLower === "fanuelgoitom79@gmail.com" || emailLower === "fani@g.com" || emailLower === "admin@merihcare.et")) {
        res.user.role = "admin";
        res.user.adminRole = "super_admin";
        localStorage.setItem("admin_user", JSON.stringify(res.user));
      }
      setToken(res.access_token);
      setUser(res.user);
    }
  };

  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  const currentEmailLower = (user?.email || "").toLowerCase().trim();
  const isSuperAdminEmail =
    currentEmailLower === "fanuelgoitom79@gmail.com" ||
    currentEmailLower === "fani@g.com" ||
    currentEmailLower === "admin@merihcare.et";

  const isAnyAdmin =
    isSuperAdminEmail ||
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    !!(user as any)?.adminRole ||
    String(user?.role).includes("admin");

  const role: UserRole = isSuperAdminEmail
    ? "super_admin"
    : isAnyAdmin
    ? "admin"
    : (user?.role as UserRole) || "admin";

  const hasPermission = (allowedRoles: UserRole[]): boolean => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    // All administrators and super administrators are allowed to access every section
    if (isAnyAdmin || role === "super_admin" || role === "admin") return true;
    const currentRole = role || (user?.role as UserRole);
    return allowedRoles.includes(currentRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!token,
        login,
        googleLogin,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
