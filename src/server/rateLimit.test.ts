/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter, resetRateLimitBuckets } from "../../server/src/middleware/rateLimit.js";
import { forgotPasswordRateLimit, loginRateLimit } from "../../server/src/routes/auth.js";

const createRequest = (overrides = {}) => ({
  path: "/api/auth/forgot-password",
  ip: "127.0.0.1",
  headers: {},
  body: {},
  ...overrides,
});

const createResponse = () => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
};

describe("rate limiter", () => {
  beforeEach(() => {
    resetRateLimitBuckets();
    vi.restoreAllMocks();
  });

  it("blocks requests after the configured limit and sets Retry-After", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: "Too many reset requests. Please wait a few minutes and try again.",
      keyFn: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
    });

    const req = createRequest({
      body: { email: "admin@wheelsnationke.co.ke" },
    });
    const next = vi.fn();

    limiter(req as never, createResponse() as never, next);
    limiter(req as never, createResponse() as never, next);

    const blockedResponse = createResponse();
    limiter(req as never, blockedResponse as never, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blockedResponse.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith({
      error: "Too many reset requests. Please wait a few minutes and try again.",
    });
  });

  it("allows requests again after the window expires", () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_000);

    const limiter = createRateLimiter({
      windowMs: 5_000,
      max: 1,
    });

    const req = createRequest();
    const next = vi.fn();

    limiter(req as never, createResponse() as never, next);

    nowSpy.mockReturnValue(7_000);

    limiter(req as never, createResponse() as never, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("uses the forgot-password route limiter configuration", () => {
    const next = vi.fn();
    const req = createRequest({
      path: "/forgot-password",
      body: { email: "admin@wheelsnationke.co.ke" },
    });

    forgotPasswordRateLimit(req as never, createResponse() as never, next);
    forgotPasswordRateLimit(req as never, createResponse() as never, next);
    forgotPasswordRateLimit(req as never, createResponse() as never, next);
    forgotPasswordRateLimit(req as never, createResponse() as never, next);
    forgotPasswordRateLimit(req as never, createResponse() as never, next);

    const blockedResponse = createResponse();
    forgotPasswordRateLimit(req as never, blockedResponse as never, next);

    expect(next).toHaveBeenCalledTimes(5);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith({
      error: "Too many reset requests. Please wait a few minutes and try again.",
    });
  });

  it("uses the login route limiter configuration", () => {
    const next = vi.fn();
    const req = createRequest({
      path: "/login",
      body: { email: "admin@wheelsnationke.co.ke" },
    });

    for (let attempt = 0; attempt < 8; attempt += 1) {
      loginRateLimit(req as never, createResponse() as never, next);
    }

    const blockedResponse = createResponse();
    loginRateLimit(req as never, blockedResponse as never, next);

    expect(next).toHaveBeenCalledTimes(8);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith({
      error: "Too many login attempts. Please wait a few minutes and try again.",
    });
  });
});
