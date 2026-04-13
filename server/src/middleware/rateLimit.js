const buckets = new Map();

export const resetRateLimitBuckets = () => {
  buckets.clear();
};

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
};

export const createRateLimiter = ({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
  keyFn,
}) => {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : getClientIp(req);
    const bucketKey = `${req.path}:${key}`;
    const existing = buckets.get(bucketKey);

    if (!existing || existing.expiresAt <= now) {
      buckets.set(bucketKey, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    existing.count += 1;
    buckets.set(bucketKey, existing);
    return next();
  };
};
