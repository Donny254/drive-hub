import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { query, withTransaction } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizePhone } from "../notifications.js";
import { sendPasswordResetEmail } from "../email.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_SESSION_DAYS = 30;
const REFRESH_COOKIE = "wheels_refresh";

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
  ...(process.env.REFRESH_COOKIE_DOMAIN
    ? { domain: process.env.REFRESH_COOKIE_DOMAIN }
    : {}),
});

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
};

const createRefreshToken = () =>
  crypto.randomBytes(48).toString("hex");

const issueSession = async (user, res) => {
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(
    Date.now() + REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  await query(
    `INSERT INTO auth_sessions (user_id, token_hash, expires_at, token_version)
     VALUES ($1, $2, $3, $4)`,
    [
      user.id,
      hashRefreshToken(refreshToken),
      expiresAt,
      user.authTokenVersion ?? user.auth_token_version ?? 0,
    ]
  );

  setRefreshCookie(res, refreshToken);

  return signToken(user);
};

export const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many login attempts. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase().trim()}`,
});
export const forgotPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many reset requests. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase().trim()}`,
});
export const resetPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many reset attempts. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String(req.body?.token || "").slice(0, 12)}`,
});

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.authTokenVersion ?? user.auth_token_version ?? 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
    }
  );

const getPasswordResetBaseUrl = () =>
  process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getPasswordValidationMessage = (password) => {
  if (String(password).length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
};

const toAuthUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  phone: row.phone || null,
  address: row.address || null,
  role: row.role,
  authTokenVersion: row.auth_token_version ?? 0,
  createdAt: row.created_at,
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, phone, address } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) {
      return res.status(400).json({ error: passwordMessage });
    }
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    if (phone && !normalizedPhone) {
      return res.status(400).json({ error: "Phone number must be a valid Kenyan mobile number" });
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO users (email, name, phone, address, role, password_hash)
       VALUES ($1, $2, $3, $4, 'user', $5)
       RETURNING id, email, name, phone, address, role, auth_token_version, created_at`,
      [email.toLowerCase(), name ?? null, normalizedPhone, address ?? null, passwordHash]
    );

    const user = toAuthUser(result.rows[0]);
    const token = await issueSession(user, res);
    res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Email already in use" });
    }
    next(error);
  }
});

router.post("/login", loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await query(
      "SELECT id, email, name, phone, address, role, password_hash, auth_token_version, created_at FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const row = result.rows[0];
    const isValid = await verifyPassword(password, row.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = toAuthUser(row);
    const token = await issueSession(user, res);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

export const forgotPasswordHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const result = await query(
      "SELECT id, email, name FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      return res.json({
        message: "If that email exists, we have sent password reset instructions.",
      });
    }

    const row = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await query(
      `UPDATE users
       SET password_reset_token_hash = $2,
           password_reset_expires_at = $3
       WHERE id = $1`,
      [row.id, tokenHash, expiresAt]
    );

    const resetUrl = `${getPasswordResetBaseUrl()}/reset-password?token=${rawToken}`;
    const emailSent = await sendPasswordResetEmail({
      to: row.email,
      name: row.name,
      resetUrl,
    });

    const payload = {
      message: "If that email exists, we have sent password reset instructions.",
    };

    if (!emailSent && process.env.NODE_ENV !== "production") {
      return res.json({
        ...payload,
        devResetToken: rawToken,
        devResetUrl: resetUrl,
      });
    }

    if (!emailSent && process.env.NODE_ENV === "production") {
      console.warn(`Password reset email could not be sent for ${normalizedEmail}.`);
    }

    return res.json(payload);
  } catch (error) {
    next(error);
  }
};

router.post("/forgot-password", forgotPasswordRateLimit, forgotPasswordHandler);

export const resetPasswordHandler = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Reset token and new password are required" });
    }
    const passwordMessage = getPasswordValidationMessage(password);
    if (passwordMessage) {
      return res.status(400).json({ error: passwordMessage });
    }

    const tokenHash = hashResetToken(String(token));
    const result = await query(
      `SELECT id
       FROM users
       WHERE password_reset_token_hash = $1
         AND password_reset_expires_at IS NOT NULL
         AND password_reset_expires_at > now()`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "This password reset link is invalid or has expired." });
    }

    const passwordHash = await hashPassword(password);
    const resetCompleted = await withTransaction(async (client) => {
      const updated = await client.query(
        `UPDATE users
         SET password_hash = $2,
             auth_token_version = auth_token_version + 1,
             password_reset_token_hash = NULL,
             password_reset_expires_at = NULL
         WHERE id = $1
           AND password_reset_token_hash = $3
           AND password_reset_expires_at > now()
         RETURNING id`,
        [result.rows[0].id, passwordHash, tokenHash]
      );

      if (updated.rowCount !== 1) {
        return false;
      }

      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = now()
         WHERE user_id = $1
           AND revoked_at IS NULL`,
        [result.rows[0].id]
      );

      return true;
    });

    if (!resetCompleted) {
      return res.status(400).json({
        error: "This password reset link is invalid or has expired.",
      });
    }

    return res.json({ message: "Password reset successful. You can now sign in." });
  } catch (error) {
    next(error);
  }
};

router.post("/reset-password", resetPasswordRateLimit, resetPasswordHandler);

export const refreshSessionHandler = async (req, res, next) => {
  try {
    const oldToken = req.cookies?.[REFRESH_COOKIE];

    if (!oldToken) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Refresh session missing" });
    }

    const oldHash = hashRefreshToken(oldToken);

    const result = await withTransaction(async (client) => {
      const sessionResult = await client.query(
        `SELECT
           s.id AS session_id,
          u.id,
          s.user_id,
           s.expires_at,
           s.revoked_at,
           s.token_version,
           u.email,
           u.name,
           u.phone,
           u.address,
           u.role,
           u.auth_token_version,
           u.created_at
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > now()
           AND s.token_version = u.auth_token_version
         FOR UPDATE OF s`,
        [oldHash]
      );

      const session = sessionResult.rows[0];

      if (!session) {
        return null;
      }

      const user = toAuthUser(session);
      const nextRefreshToken = createRefreshToken();
      const nextHash = hashRefreshToken(nextRefreshToken);
      const nextExpiresAt = new Date(
        Date.now() + REFRESH_SESSION_DAYS * 24 * 60 * 60 * 1000
      );

      await client.query(
        `UPDATE auth_sessions
         SET revoked_at = now(), last_used_at = now()
         WHERE id = $1`,
        [session.session_id]
      );

      await client.query(
        `INSERT INTO auth_sessions (user_id, token_hash, expires_at, token_version)
         VALUES ($1, $2, $3, $4)`,
        [user.id, nextHash, nextExpiresAt, user.authTokenVersion]
      );

      return { user, nextRefreshToken };
    });

    if (!result) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Refresh session invalid" });
    }

    setRefreshCookie(res, result.nextRefreshToken);

    return res.json({
      token: signToken(result.user),
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

router.post("/refresh", refreshSessionHandler);

export const logoutHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (token) {
      await query(
        `UPDATE auth_sessions
         SET revoked_at = now()
         WHERE token_hash = $1
           AND revoked_at IS NULL`,
        [hashRefreshToken(token)]
      );
    }

    clearRefreshCookie(res);
    return res.json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
};

router.post("/logout", logoutHandler);

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, email, name, phone, role, auth_token_version, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(toAuthUser(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

export default router;
