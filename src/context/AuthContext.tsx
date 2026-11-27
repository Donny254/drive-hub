import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  initializeAuthSession,
  type RefreshedAuth,
} from "@/lib/api";
import { getApiErrorMessage } from "@/lib/feedback";

type User = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address?: string | null;
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

const isJwtExpired = (token: string): boolean => {
  try {
    const encodedPayload = token
      .split(".")[1]
      ?.replace(/-/g, "+")
      .replace(/_/g, "/");
    if (!encodedPayload) return false;
    const payload = JSON.parse(
      atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "="))
    ) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return false;
  }
};

const loadStoredAuth = (): AuthState => {
  try {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const userRaw = localStorage.getItem(STORAGE_USER);
    const user = userRaw ? (JSON.parse(userRaw) as User) : null;

    if (!token || !user) return { token: null, user: null };
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

const persistAuth = (state: AuthState) => {
  if (state.token && state.user) {
    if (localStorage.getItem(STORAGE_TOKEN) !== state.token) {
      localStorage.setItem(STORAGE_TOKEN, state.token);
    }

    const serializedUser = JSON.stringify(state.user);
    if (localStorage.getItem(STORAGE_USER) !== serializedUser) {
      localStorage.setItem(STORAGE_USER, serializedUser);
    }
  } else {
    if (localStorage.getItem(STORAGE_TOKEN) !== null) {
      localStorage.removeItem(STORAGE_TOKEN);
    }
    if (localStorage.getItem(STORAGE_USER) !== null) {
      localStorage.removeItem(STORAGE_USER);
    }
  }
};

const isUser = (value: unknown): value is User =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === "string" &&
  typeof (value as Record<string, unknown>).email === "string";

const applyRefreshedAuth = (
  auth: RefreshedAuth,
  setUser: (user: User | null) => void,
  setToken: (token: string | null) => void
) => {
  if (isUser(auth.user)) {
    setUser(auth.user);
  }
  setToken(auth.token);
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
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  useEffect(() => {
    const handleRefreshed = (event: Event) => {
      const auth = (event as CustomEvent<RefreshedAuth>).detail;
      if (auth?.token) {
        applyRefreshedAuth(auth, setUser, setToken);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_TOKEN && event.newValue === null) {
        setUser(null);
        setToken(null);
        return;
      }

      if (event.key === STORAGE_TOKEN || event.key === STORAGE_USER) {
        const stored = loadStoredAuth();
        setUser(stored.user);
        setToken(stored.token);
      }
    };

    window.addEventListener("auth:token", handleRefreshed);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("auth:token", handleRefreshed);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let active = true;
    const stored = loadStoredAuth();

    void initializeAuthSession()
      .then((auth) => {
        if (!active) return;
        if (auth) {
          applyRefreshedAuth(auth, setUser, setToken);
        } else if (stored.token && isJwtExpired(stored.token)) {
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
      })
      .catch((error: unknown) => {
        console.error("Session initialization failed.", error);
      });

    return () => {
      active = false;
    };
  }, [hydrated]);

  useEffect(() => {
    if (hydrated) {
      persistAuth({ user, token });
    }
  }, [user, token, hydrated]);

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
    void apiFetch("/api/auth/logout", { method: "POST" })
      .then((response) => {
        if (!response.ok) {
          console.error(`Server logout failed with HTTP ${response.status}.`);
        }
      })
      .catch((error: unknown) => {
        console.error("Server logout request failed.", error);
      });
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
