/** Wraps an async route handler so unhandled rejections go to next(err) */
export const asyncRoute = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/** Strip HTML tags and trim a string value — prevents stored XSS */
export const sanitizeText = (value) => {
  if (value === null || value === undefined) return null;
  return String(value)
    .replace(/<[^>]*>/g, "")
    .trim() || null;
};

/** Sanitize an object's string fields by key list */
export const sanitizeFields = (obj, keys) => {
  const result = { ...obj };
  for (const key of keys) {
    if (key in result) result[key] = sanitizeText(result[key]);
  }
  return result;
};
