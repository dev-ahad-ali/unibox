import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "v1";

export function hmacSha256Hex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function hmacSha256Base64(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64");
}

/** Constant-time compare of two strings of arbitrary encoding. */
export function safeEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  // timingSafeEqual throws on length mismatch, so the length check has to come
  // first. Length is not secret here — the digests are fixed width.
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function getKey() {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    return null;
  }

  // Accept either 64 hex chars or a base64 encoding of 32 bytes.
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY must decode to 32 bytes (64 hex chars, or base64 of 32 bytes). Generate one with: openssl rand -hex 32"
    );
  }

  return key;
}

export function isEncryptionConfigured() {
  return Boolean(getKey());
}

/** Encrypts a platform access token for storage in `channels.access_token_encrypted`. */
export function encryptSecret(plaintext: string) {
  const key = getKey();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY is not set — cannot encrypt channel credentials.");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Reverses `encryptSecret`. Returns null when the value is not in our envelope
 * format, which lets a project migrate from plaintext seeds without crashing.
 */
export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return null;
  }

  const key = getKey();
  if (!key) {
    return null;
  }

  try {
    const [, iv, tag, ciphertext] = parts;
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}
