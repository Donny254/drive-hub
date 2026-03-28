/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/src/db.js", () => ({
  query: vi.fn(),
}));

vi.mock("../../server/src/email.js", async () => {
  const actual = await vi.importActual<typeof import("../../server/src/email.js")>(
    "../../server/src/email.js"
  );
  return {
    ...actual,
    sendPasswordResetEmail: vi.fn(),
  };
});

vi.mock("../../server/src/utils/password.js", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(async () => true),
}));

import { query } from "../../server/src/db.js";
import { sendPasswordResetEmail } from "../../server/src/email.js";
import { resolveCurrentUser } from "../../server/src/middleware/auth.js";
import { forgotPasswordHandler, resetPasswordHandler } from "../../server/src/routes/auth.js";

const mockedQuery = vi.mocked(query);
const mockedSendPasswordResetEmail = vi.mocked(sendPasswordResetEmail);

const createResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
};

describe("auth backend", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSendPasswordResetEmail.mockReset();
    process.env.NODE_ENV = "test";
    process.env.CORS_ORIGIN = "http://localhost:5173";
  });

  it("rejects reset-password when the token is expired or invalid", async () => {
    mockedQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] } as never);

    const req = {
      body: {
        token: "expired-token",
        password: "StrongPass1",
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await resetPasswordHandler(req as never, res as never, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "This password reset link is invalid or has expired.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns null for a revoked token version", async () => {
    mockedQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: "user-1",
          email: "admin@wheelsnationke.co.ke",
          role: "admin",
          auth_token_version: 3,
        },
      ],
    } as never);

    const result = await resolveCurrentUser({
      id: "user-1",
      tokenVersion: 2,
    });

    expect(result).toBeNull();
  });

  it("increments auth token version when password reset succeeds", async () => {
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-1" }],
      } as never)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [],
      } as never);

    const req = {
      body: {
        token: "valid-token",
        password: "StrongPass1",
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await resetPasswordHandler(req as never, res as never, next);

    expect(res.json).toHaveBeenCalledWith({
      message: "Password reset successful. You can now sign in.",
    });
    expect(mockedQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("auth_token_version = auth_token_version + 1"),
      ["user-1", "hashed:StrongPass1"]
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a dev reset link when mail is unavailable outside production", async () => {
    process.env.NODE_ENV = "development";
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-1", email: "admin@wheelsnationke.co.ke", name: "Admin" }],
      } as never)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [],
      } as never);
    mockedSendPasswordResetEmail.mockResolvedValue(false);

    const req = {
      body: {
        email: "admin@wheelsnationke.co.ke",
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await forgotPasswordHandler(req as never, res as never, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "If that email exists, we have sent password reset instructions.",
        devResetToken: expect.any(String),
        devResetUrl: expect.stringContaining("/reset-password?token="),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("warns in production when password reset email cannot be sent", async () => {
    process.env.NODE_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "user-1", email: "admin@wheelsnationke.co.ke", name: "Admin" }],
      } as never)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [],
      } as never);
    mockedSendPasswordResetEmail.mockResolvedValue(false);

    const req = {
      body: {
        email: "admin@wheelsnationke.co.ke",
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await forgotPasswordHandler(req as never, res as never, next);

    expect(res.json).toHaveBeenCalledWith({
      message: "If that email exists, we have sent password reset instructions.",
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Password reset email could not be sent for admin@wheelsnationke.co.ke."
    );
    expect(next).not.toHaveBeenCalled();
  });
});
