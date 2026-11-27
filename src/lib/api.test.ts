import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, initializeAuthSession } from "@/lib/api";

const response = (status: number, data: unknown = {}) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn(async () => data),
  }) as unknown as Response;

describe("apiFetch authentication refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("refreshes once and retries an unauthorized API request", async () => {
    localStorage.setItem("auth_token", "expired-token");
    localStorage.setItem("auth_user", JSON.stringify({ id: "user-1" }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(
        response(200, {
          token: "new-token",
          user: { id: "user-1", email: "member@example.com" },
        })
      )
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiFetch("/api/bookings", {
      headers: { Authorization: "Bearer expired-token" },
    });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/refresh");
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization")
    ).toBe("Bearer new-token");
    expect(localStorage.getItem("auth_token")).toBe("new-token");
  });

  it("does not attempt refresh for authentication endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(401));
    vi.stubGlobal("fetch", fetchMock);
    const expiredListener = vi.fn();
    window.addEventListener("auth:expired", expiredListener);

    const result = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { Authorization: "Bearer existing-token" },
    });

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(expiredListener).not.toHaveBeenCalled();
    window.removeEventListener("auth:expired", expiredListener);
  });

  it("does not attempt refresh for requests without a bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(401));
    vi.stubGlobal("fetch", fetchMock);
    const expiredListener = vi.fn();
    window.addEventListener("auth:expired", expiredListener);

    const result = await apiFetch("/api/bookings");

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(expiredListener).not.toHaveBeenCalled();
    window.removeEventListener("auth:expired", expiredListener);
  });

  it("recovers a session from the refresh cookie when local auth is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(200, {
        token: "recovered-token",
        user: { id: "user-2", email: "recovered@example.com" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const auth = await initializeAuthSession();

    expect(auth?.token).toBe("recovered-token");
    expect(localStorage.getItem("auth_token")).toBe("recovered-token");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});
