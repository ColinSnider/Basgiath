import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { login as loginFn, register as registerFn, logout as logoutFn, getMe } from "./auth-fns";
import { createGuestSessionId, guestUser, isGuestSessionId } from "./session-auth.js";

const SESSION_KEY = "basgiath:session";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  profileImageUrl?: string;
  isGuest?: boolean;
};

type AuthCtx = {
  user: AuthUser | null;
  sessionId: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  register: (
    username: string,
    password: string,
    displayName: string,
    email?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => void;
  updateEmail: (email: string) => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    getMe({ data: { sessionId: stored } })
      .then((u) => {
        if (u) {
          setUser(u as AuthUser);
          setSessionId(stored);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginFn({ data: { username, password } });
    localStorage.setItem(SESSION_KEY, res.sessionId);
    setSessionId(res.sessionId);
    setUser(res.user as AuthUser);
  }, []);

  const register = useCallback(
    async (username: string, password: string, displayName: string, email?: string) => {
      const res = await registerFn({ data: { username, password, displayName, email } });
      localStorage.setItem(SESSION_KEY, res.sessionId);
      setSessionId(res.sessionId);
      setUser(res.user as AuthUser);
    },
    [],
  );

  const continueAsGuest = useCallback(async () => {
    const sid = createGuestSessionId();
    localStorage.setItem(SESSION_KEY, sid);
    setSessionId(sid);
    setUser(guestUser() as AuthUser);
  }, []);

  const logout = useCallback(async () => {
    const sid = localStorage.getItem(SESSION_KEY);
    if (sid && !isGuestSessionId(sid)) {
      await logoutFn({ data: { sessionId: sid } }).catch(() => {
        console.warn("Failed to clear session on the server during logout.");
      });
    }
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setUser(null);
  }, []);

  const updateDisplayName = useCallback((name: string) => {
    setUser((u) => (u ? { ...u, displayName: name } : u));
  }, []);

  const updateEmail = useCallback((email: string) => {
    setUser((u) => (u ? { ...u, email } : u));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        loading,
        login,
        continueAsGuest,
        register,
        logout,
        updateDisplayName,
        updateEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
