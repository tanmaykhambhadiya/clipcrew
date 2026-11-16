import { db, type Db } from "@/db/query";

// Name kept from the Supabase days so the many route files don't change. It is our own Postgres.
export function getSupabaseAdmin(): Db {
  return db;
}
export const getDb = getSupabaseAdmin;
