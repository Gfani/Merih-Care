import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../services/api";
import { User, UserRole } from "../types";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  const [token, setToken] = useState<string | null>(() => api.getStoredToken());
  const [user, setUser] = useState<User | null>(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem("admin_user") : null;
    if (!raw || raw === "undefined" || raw === "null") return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!token || !!user);
  const [isLoading, setIsLoading] = useState<boolean>(() => !token);

  useEffect(() => {
    let isMounted = true;
    const validateActiveSession = async () => {
      const storedToken = api.getStoredToken();
      if (storedToken && !token) {
        setToken(storedToken);
      }
      try {
        const profile = await api.getMe();
        if (isMounted && profile) {
          setUser(profile);
          setIsAuthenticated(true);
          const currentToken = api.getStoredToken();
          if (currentToken) setToken(currentToken);
        }
      } catch {
        // Attempt silent token refresh via HttpOnly refresh_token cookie or session storage
        try {
          const refreshed = await api.refreshToken();
          if (isMounted && refreshed) {
            setToken(refreshed);
            const profile = await api.getMe();
            if (isMounted && profile) {
              setUser(profile);
              setIsAuthenticated(true);
              return;
            }
          }
        } catch (_) {}

        // If validation failed and there is no active token, clear session
        if (isMounted && !api.getStoredToken()) {
          api.clearSessionTokens();
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    validateActiveSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Proactive background cookie session refresh
    const checkAndRefreshToken = async () => {
      if (!isAuthenticated) return;
      try {
        const refreshedToken = await api.refreshToken();
        if (refreshedToken) {
          setToken(refreshedToken);
        }
      } catch (_) {}
    };

    const interval = setInterval(checkAndRefreshToken, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    };

    window.addEventListener("merihcare:session_expired", handleSessionExpired);
    return () => window.removeEventListener("merihcare:session_expired", handleSessionExpired);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setToken(res.access_token);
    setUser(res.user);
    setIsAuthenticated(true);
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
    }
    if (res.user) {
      setUser(res.user);
      setIsAuthenticated(true);
    }
  };

  const appleLogin = async (identityToken?: string, givenName?: string, familyName?: string) => {
    if (!identityToken) {
      throw new Error("Apple Sign-In identity token is required.");
    }
    const res = await api.appleAuth(identityToken, "admin", givenName, familyName);

    if (res.access_token) {
      setToken(res.access_token);
    }
    if (res.user) {
      setUser(res.user);
      setIsAuthenticated(true);
    }
  };

  const logout = () => {
    api.logout();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
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
        isAuthenticated,
        isLoading,
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
