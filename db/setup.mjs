// One-time database setup for self-hosted PostgreSQL.
// Usage: DATABASE_URL=postgres://... PGRST_AUTH_PASSWORD=... node db/setup.mjs
// Creates the tables (db/schema.sql) and the `authenticator` login role PostgREST connects with.
import { readFileSync } from "node:fs";
import pg from "pg";

const { DATABASE_URL, PGRST_AUTH_PASSWORD } = process.env;
if (!DATABASE_URL || !PGRST_AUTH_PASSWORD) {
  console.error("Set DATABASE_URL and PGRST_AUTH_PASSWORD.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query("select to_regclass('public.profiles') as t");
  if (rows[0].t) {
    console.error("Tables already exist — nothing changed.");
    process.exit(1);
  }
  await client.query("begin");
  await client.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  const pw = PGRST_AUTH_PASSWORD.replace(/'/g, "''");
  await client.query(`do $$ begin
    if not exists (select from pg_roles where rolname = 'authenticator') then
      create role authenticator login noinherit password '${pw}';
    else
      alter role authenticator password '${pw}';
    end if;
  end $$;`);
  await client.query("grant anon to authenticator; grant service_role to authenticator;");
  await client.query("commit");
  console.log("Database ready: tables created, roles anon / service_role / authenticator set up.");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("Setup failed, nothing was changed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
