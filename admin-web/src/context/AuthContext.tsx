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
      return JSON.parse(raw);
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
    setToken(res.access_token);
    setUser(res.user);
  };

  const googleLogin = async (idToken?: string) => {
    const tokenToUse = idToken || `test-google-token:admin.${Date.now()}@gmail.com:MerihCare Admin`;
    const res = await api.googleAuth(tokenToUse, "admin");
    if (res.access_token) {
      setToken(res.access_token);
      setUser(res.user);
    }
  };

  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
  };

  const role: UserRole = (user?.role as UserRole) || (user as any)?.adminRole || "super_admin";

  const hasPermission = (allowedRoles: UserRole[]): boolean => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    const currentRole = role || (user?.role as UserRole) || "super_admin";
    if (currentRole === "super_admin" || currentRole === "admin") return true;
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
