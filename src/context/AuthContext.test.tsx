import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock, initializeAuthSessionMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  initializeAuthSessionMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: apiFetchMock,
  initializeAuthSession: initializeAuthSessionMock,
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

const AuthState = () => {
  const { user, token } = useAuth();
  return <div>{`${user?.email || "signed-out"}|${token || "no-token"}`}</div>;
};

describe("AuthProvider session renewal", () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  beforeEach(() => {
    initializeAuthSessionMock.mockResolvedValue(null);
  });

  it("renews an expired stored token during hydration", async () => {
    const expiredPayload = btoa(JSON.stringify({ exp: 1 }));
    localStorage.setItem("auth_token", `header.${expiredPayload}.signature`);
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "user-1",
        email: "member@example.com",
        name: "Member",
        phone: null,
        role: "user",
      })
    );
    initializeAuthSessionMock.mockResolvedValue({
      token: "renewed-token",
      user: {
        id: "user-1",
        email: "member@example.com",
        name: "Member",
        phone: null,
        role: "user",
      },
    });

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("member@example.com|renewed-token")).toBeInTheDocument();
    });
    expect(initializeAuthSessionMock).toHaveBeenCalledOnce();
  });

  it("updates auth state when a token is refreshed by another request", async () => {
    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("auth:token", {
          detail: {
            token: "new-tab-token",
            user: { id: "user-2", email: "other@example.com" },
          },
        })
      );
    });

    expect(screen.getByText("other@example.com|new-tab-token")).toBeInTheDocument();
  });
});
