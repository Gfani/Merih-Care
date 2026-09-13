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
  appleLogin: (identityToken?: string, givenName?: string, familyName?: string) => Promise<void>;
  logout: () => void;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem("admin_token");
    if (!isTokenValid(stored)) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      return null;
    }
    return stored;
  });
  const [user, setUser] = useState<User | null>(() => {
    const storedToken = localStorage.getItem("admin_token");
    if (!isTokenValid(storedToken)) return null;
    const raw = localStorage.getItem("admin_user");
    if (!raw || raw === "undefined" || raw === "null") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const validateActiveSession = async () => {
      const stored = localStorage.getItem("admin_token");
      if (!isTokenValid(stored)) {
        setToken(null);
        setUser(null);
        return;
      }
      try {
        const profile = await api.getAdminProfile();
        if (!profile) {
          throw new Error("Invalid session");
        }
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        setToken(null);
        setUser(null);
      }
    };
    if (token) {
      validateActiveSession();
    }
  }, []);

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
    let tokenToUse = idToken;

    if (!tokenToUse && typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "256475797217-o481d29fdaufp2fp6mmkide2u52ohpp7.apps.googleusercontent.com";
      tokenToUse = await new Promise<string>((resolve, reject) => {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: googleClientId,
            callback: (response: { credential?: string }) => {
              if (response.credential) {
                resolve(response.credential);
              } else {
                reject(new Error("No Google credential returned."));
              }
            },
          });
          (window as any).google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              reject(new Error("Google One Tap prompt was skipped or not displayed. Please use manual sign in."));
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    }

    if (!tokenToUse) {
      throw new Error("Google Sign-In credential is required.");
    }

    const res = await api.googleAuth(tokenToUse, "admin");
    if (res.access_token) {
      setToken(res.access_token);
      setUser(res.user);
    }
  };

  const appleLogin = async (identityToken?: string, givenName?: string, familyName?: string) => {
    if (!identityToken) {
      throw new Error("Apple Sign-In identity token is required.");
    }
    const res = await api.appleAuth(identityToken, "admin", givenName, familyName);

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

  const role: UserRole = (user?.adminRole as UserRole) || (user?.role as UserRole) || "admin";

  const hasPermission = (allowedRoles: UserRole[]): boolean => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (role === "super_admin") return true;
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
        appleLogin,
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
