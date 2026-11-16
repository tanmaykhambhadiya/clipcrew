import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM with a key derived from the SECRET_KEY environment variable. Used only for the
// password ClipCrew issues to a clipper, so the super admin can see it again. Without SECRET_KEY
// nothing is stored (the feature is off) — a database copy alone never reveals a password.

function key(): Buffer | null {
  const s = process.env.SECRET_KEY;
  return s && s.length >= 16 ? createHash("sha256").update(`clipcrew-visible-password:${s}`).digest() : null;
}

export const secretBoxEnabled = () => key() !== null;

export function seal(plain: string): string | null {
  const k = key();
  if (!k) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
}

export function open(sealed: string | null | undefined): string | null {
  const k = key();
  if (!k || !sealed) return null;
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null; // SECRET_KEY changed since it was stored
  }
}
