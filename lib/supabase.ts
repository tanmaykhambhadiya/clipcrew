import "server-only";
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";

// Database access for all server code. The app talks to its own PostgreSQL through PostgREST
// (same query API the code used with Supabase). Requests carry a token for the `service_role`
// database role, signed with POSTGREST_JWT_SECRET; requests without it get the `anon` role, which
// can read nothing. The name getSupabaseAdmin is kept so the many call sites don't change.

let client: PostgrestClient | null = null;

/** HS256 JWT { role: "service_role" } — what PostgREST checks to switch to the service role. */
function serviceToken(secret: string): string {
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role", iat: Math.floor(Date.now() / 1000) })}`;
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

export function getSupabaseAdmin(): PostgrestClient {
  if (client) return client;
  const url = process.env.POSTGREST_URL;
  const secret = process.env.POSTGREST_JWT_SECRET;
  if (!url || !secret) throw new Error("Database is not configured: set POSTGREST_URL and POSTGREST_JWT_SECRET.");
  client = new PostgrestClient(url.replace(/\/+$/, ""), {
    headers: { Authorization: `Bearer ${serviceToken(secret)}` },
  });
  return client;
}

export const getDb = getSupabaseAdmin;
