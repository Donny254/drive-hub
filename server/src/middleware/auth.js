import jwt from "jsonwebtoken";
import { query } from "../db.js";

export const resolveCurrentUser = async (payload) => {
  const result = await query(
    "SELECT id, email, role, auth_token_version FROM users WHERE id = $1",
    [payload.id]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  if ((payload.tokenVersion ?? 0) !== row.auth_token_version) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    tokenVersion: row.auth_token_version,
  };
};

export const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await resolveCurrentUser(payload);
  } catch {
    req.user = null;
  }

  return next();
};

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await resolveCurrentUser(payload);
    if (!currentUser) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = currentUser;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
};

export const requireAdminOrOwner = (getOwnerId) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Missing auth token" });
  }
  if (req.user.role === "admin") return next();

  const ownerId = getOwnerId(req);
  if (ownerId && ownerId === req.user.id) return next();
  return res.status(403).json({ error: "Forbidden" });
};
