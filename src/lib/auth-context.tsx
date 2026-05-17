import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { login as loginFn, register as registerFn, logout as logoutFn, getMe } from "./auth-fns";

const SESSION_KEY = "basgiath:session";

export type AuthUser = { id: number; username: string; displayName: string };

type AuthCtx = {
  user: AuthUser | null;
  sessionId: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => void;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) { setLoading(false); return; }
    getMe({ data: { sessionId: stored } })
      .then((u) => {
        if (u) { setUser(u); setSessionId(stored); }
        else { localStorage.removeItem(SESSION_KEY); }
      })
      .catch(() => { localStorage.removeItem(SESSION_KEY); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginFn({ data: { username, password } });
    localStorage.setItem(SESSION_KEY, res.sessionId);
    setSessionId(res.sessionId);
    setUser(res.user);
  }, []);

  const register = useCallback(async (username: string, password: string, displayName: string) => {
    const res = await registerFn({ data: { username, password, displayName } });
    localStorage.setItem(SESSION_KEY, res.sessionId);
    setSessionId(res.sessionId);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    const sid = localStorage.getItem(SESSION_KEY);
    if (sid) await logoutFn({ data: { sessionId: sid } }).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setUser(null);
  }, []);

  const updateDisplayName = useCallback((name: string) => {
    setUser((u) => (u ? { ...u, displayName: name } : u));
  }, []);

  return (
    <AuthContext.Provider value={{ user, sessionId, loading, login, register, logout, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
