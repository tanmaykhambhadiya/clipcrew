import pg from "pg";

// Postgres returns bigint, numeric and date/timestamp values as strings or Date objects by default.
// The app does arithmetic on money and view counts and compares week dates as 'YYYY-MM-DD' strings,
// so parse them into the plain JS types the code expects. (Money is paise and views stay far below 2^53.)
pg.types.setTypeParser(20, (v) => Number(v)); //   int8
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(1082, (v) => v); //         date -> "YYYY-MM-DD"
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz -> ISO string
pg.types.setTypeParser(1114, (v) => new Date(`${v.replace(" ", "T")}Z`).toISOString()); // timestamp (UTC)

const globalForPool = globalThis as unknown as { __ccPool?: pg.Pool };

export function pool(): pg.Pool {
  if (globalForPool.__ccPool) return globalForPool.__ccPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const p = new pg.Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 20_000,
    application_name: "clipcrew-api",
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  p.on("error", (e) => console.error("[db] idle client error", e.message));
  globalForPool.__ccPool = p;
  return p;
}

/** Raw parameterised SQL for the few queries the builder can't express (joins, aggregates). */
export async function sql<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query(text, params as any[])).rows as T[];
}

export async function sqlOne<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await sql<T>(text, params))[0] ?? null;
}

export async function closePool() {
  await globalForPool.__ccPool?.end();
  globalForPool.__ccPool = undefined;
}

/** Runs fn inside one transaction; rolls back if it throws. */
export async function tx<T>(fn: (q: <R = Record<string, any>>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(async (text, params = []) => (await client.query(text, params as any[])).rows);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
