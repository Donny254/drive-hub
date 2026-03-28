import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizePhone } from "../notifications.js";
import { sendPasswordResetEmail } from "../email.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many login attempts. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase().trim()}`,
});
const forgotPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many reset requests. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase().trim()}`,
});
const resetPasswordRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: "Too many reset attempts. Please wait a few minutes and try again.",
  keyFn: (req) => `${req.ip}:${String(req.body?.token || "").slice(0, 12)}`,
});

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

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
  role: row.role,
  createdAt: row.created_at,
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.body;
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
      `INSERT INTO users (email, name, phone, role, password_hash)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING id, email, name, phone, role, created_at`,
      [email.toLowerCase(), name ?? null, normalizedPhone, passwordHash]
    );

    const user = toAuthUser(result.rows[0]);
    const token = signToken(user);
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
      "SELECT id, email, name, phone, role, password_hash, created_at FROM users WHERE email = $1",
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
    const token = signToken(user);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", forgotPasswordRateLimit, async (req, res, next) => {
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

    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", resetPasswordRateLimit, async (req, res, next) => {
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
    await query(
      `UPDATE users
       SET password_hash = $2,
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL
       WHERE id = $1`,
      [result.rows[0].id, passwordHash]
    );

    return res.json({ message: "Password reset successful. You can now sign in." });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, email, name, phone, role, created_at FROM users WHERE id = $1",
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
