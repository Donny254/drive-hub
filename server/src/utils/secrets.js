import crypto from "node:crypto";

// AES-256-GCM at-rest encryption for secrets stored in site_settings
// (M-Pesa Daraja credentials). Key comes from SETTINGS_ENCRYPTION_KEY; with
// it unset, encryptSecret returns null so callers must refuse to store —
// plaintext credentials never touch the database.

const getKey = () => {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
};

export const encryptSecret = (plain) => {
  const key = getKey();
  if (!key || !plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
};

// Returns the plaintext, or null when the key is unset/wrong or the value is
// tampered with (GCM auth failure) — callers treat null as "not configured".
export const decryptSecret = (stored) => {
  const key = getKey();
  if (!key || !stored) return null;
  try {
    const [version, ivB64, tagB64, dataB64] = String(stored).split(":");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
};
