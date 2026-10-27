import crypto from "node:crypto";
import { sessionSecret } from "./config";

function key(): Buffer {
  return crypto.createHash("sha256").update(sessionSecret(), "utf8").digest();
}

function b64url(input: Buffer): string {
  return input.toString("base64url");
}

/** Encrypts an object into a compact string (AES-256-GCM). */
export function seal(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [b64url(iv), b64url(payload), b64url(tag)].join(".");
}

/** Decrypts a string produced by seal(). Returns null on failure. */
export function unseal<T>(token: string | undefined | null): T | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, payload, tag] = parts.map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
