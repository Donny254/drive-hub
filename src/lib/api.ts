import { getApiErrorMessage } from "@/lib/feedback";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.wheelsnation.co.ke";

export const getApiBaseUrl = () => API_BASE_URL;

let refreshPromise: Promise<RefreshedAuth | null> | null = null;

const REFRESH_LOCK_NAME = "drive-hub-auth-refresh";

export type RefreshedAuth = {
  token: string;
  user?: unknown;
};

const getStoredAuth = (): RefreshedAuth | null => {
  const token = localStorage.getItem("auth_token");
  if (!token) return null;

  const userRaw = localStorage.getItem("auth_user");
  let user: unknown;

  try {
    user = userRaw ? JSON.parse(userRaw) : undefined;
  } catch {
    user = undefined;
  }

  return { token, user };
};

const refreshSession = async (
  rejectedToken?: string
): Promise<RefreshedAuth | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refresh = async (): Promise<RefreshedAuth | null> => {
          if (rejectedToken) {
            const currentAuth = getStoredAuth();
            if (currentAuth && currentAuth.token !== rejectedToken) {
              return currentAuth;
            }
          }

          const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });

          if (response.status === 401) {
            return null;
          }

          if (!response.ok) {
            throw new Error(
              `Session refresh failed with HTTP ${response.status}.`
            );
          }

          const data = await response.json();
          if (typeof data.token !== "string") {
            throw new Error("Session refresh response did not contain a token.");
          }

          const auth = {
            token: data.token,
            ...(data.user ? { user: data.user } : {}),
          };
          localStorage.setItem("auth_token", auth.token);
          if (auth.user) {
            localStorage.setItem("auth_user", JSON.stringify(auth.user));
          }
          return auth;
        };

        const auth =
          typeof navigator !== "undefined" && navigator.locks
          ? await navigator.locks.request(REFRESH_LOCK_NAME, refresh)
          : await refresh();

        if (!auth) {
          return null;
        }

        window.dispatchEvent(
          new CustomEvent("auth:token", { detail: auth })
        );
        return auth;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
};

export const refreshAuthSession = (rejectedToken: string) =>
  refreshSession(rejectedToken);

export const initializeAuthSession = () => refreshSession();

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const isApiRequest = new URL(url, API_BASE_URL).origin === new URL(API_BASE_URL).origin;

  const originalHeaders = new Headers(options.headers || {});

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!originalHeaders.has("Content-Type") && options.body && !isFormData) {
    originalHeaders.set("Content-Type", "application/json");
  }

  const authorization = originalHeaders.get("Authorization") || "";
  const hasBearerToken = /^Bearer\s+/i.test(authorization);
  const isAuthEndpoint =
    /\/api\/auth\/(login|register|refresh|logout)(?:[/?#]|$)/i.test(path);
  const isNonReplayableBody =
    typeof ReadableStream !== "undefined" &&
    options.body instanceof ReadableStream;

  const request = (headers: Headers) =>
    fetch(url, {
      ...options,
      headers,
      credentials: options.credentials ?? (isApiRequest ? "include" : "same-origin"),
    });

  const resp = await request(originalHeaders);

  if (
    resp.status !== 401 ||
    !hasBearerToken ||
    isAuthEndpoint ||
    !isApiRequest
  ) {
    return resp;
  }

  const rejectedToken = authorization.replace(/^Bearer\s+/i, "");
  const refreshedAuth = rejectedToken
    ? await refreshAuthSession(rejectedToken)
    : null;

  if (!refreshedAuth) {
    window.dispatchEvent(new CustomEvent("auth:expired"));
    return resp;
  }

  if (isNonReplayableBody) {
    return resp;
  }

  const retryHeaders = new Headers(originalHeaders);
  retryHeaders.set("Authorization", `Bearer ${refreshedAuth.token}`);

  const retryResponse = await request(retryHeaders);
  if (retryResponse.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
  return retryResponse;
};

export const resolveImageUrl = (url?: string | null) => {
  if (!url) return "";

  if (url.startsWith("http")) return url;

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return `${API_BASE_URL}/${url}`;
};

export const uploadImage = async (file: File, token?: string | null) => {
  const formData = new FormData();
  formData.append("image", file);

  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const resp = await apiFetch("/api/uploads", {
    method: "POST",
    body: formData,
    headers,
  });

  if (!resp.ok) {
    throw new Error(await getApiErrorMessage(resp, "Upload failed"));
  }

  return resp.json() as Promise<{ url: string }>;
};
