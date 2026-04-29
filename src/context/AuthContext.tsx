import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/feedback";

type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "user" | "admin";
  createdAt?: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
};

type AuthContextValue = AuthState & {
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
};

const STORAGE_TOKEN = "auth_token";
const STORAGE_USER = "auth_user";

const AuthContext = createContext<AuthContextValue | null>(null);

const loadStoredAuth = (): AuthState => {
  try {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const userRaw = localStorage.getItem(STORAGE_USER);
    const user = userRaw ? (JSON.parse(userRaw) as User) : null;

    // Treat partially persisted auth as signed out so protected routes don't
    // admit a stale user object without a valid bearer token.
    if (!token || !user) {
      return { token: null, user: null };
    }

    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const persistAuth = (state: AuthState) => {
  if (state.token && state.user) {
    localStorage.setItem(STORAGE_TOKEN, state.token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(state.user));
  } else {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadStoredAuth();
    setUser(stored.user);
    setToken(stored.token);
    setHydrated(true);
  }, []);

  useEffect(() => {
    persistAuth({ user, token });
  }, [user, token]);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!resp.ok) {
      throw new Error(await getApiErrorMessage(resp, "Login failed"));
    }

    const data = await resp.json();
    setUser(data.user);
    setToken(data.token);
  }, []);

  const register = useCallback(async (name: string, email: string, phone: string, password: string) => {
    const resp = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, phone, password }),
    });

    if (!resp.ok) {
      throw new Error(await getApiErrorMessage(resp, "Registration failed"));
    }

    const data = await resp.json();
    setUser(data.user);
    setToken(data.token);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      hydrated,
      login,
      register,
      logout,
    }),
    [user, token, hydrated, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
