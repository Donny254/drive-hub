import jwt from "jsonwebtoken";

export const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch {
    req.user = null;
  }

  return next();
};

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
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
