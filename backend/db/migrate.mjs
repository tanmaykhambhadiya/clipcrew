// Applies db/migrations/*.sql in order, each in its own transaction, and records them in schema_migrations.
//   DATABASE_URL=postgres://... [APP_DB_PASSWORD=...] node db/migrate.mjs
// Use an owner/superuser URL for migrations (not the limited clipcrew_app user).
// 0001 is marked as applied (not re-run) if the tables already exist from the earlier manual setup.
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const { DATABASE_URL, APP_DB_PASSWORD } = process.env;
if (!DATABASE_URL) {
  console.error("Set DATABASE_URL.");
  process.exit(1);
}

const dir = new URL("./migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
try {
  await client.query("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await client.query("select id from schema_migrations")).rows.map((r) => r.id));
  let applied = 0;

  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    if (done.has(id)) continue;

    if (id === "0001_init") {
      const exists = (await client.query("select to_regclass('public.profiles') as t")).rows[0].t;
      if (exists) {
        await client.query("insert into schema_migrations (id) values ($1)", [id]);
        console.log(`${id}: tables already exist — marked as applied`);
        continue;
      }
    }

    let sql = readFileSync(new URL(file, dir), "utf8");
    if (sql.includes("{{APP_DB_PASSWORD}}")) {
      if (!APP_DB_PASSWORD || APP_DB_PASSWORD.includes("'") || APP_DB_PASSWORD.includes(String.fromCharCode(92))) {
        throw new Error(`${id} needs APP_DB_PASSWORD (letters, numbers and symbols, but no quote or backslash)`);
      }
      sql = sql.replaceAll("{{APP_DB_PASSWORD}}", APP_DB_PASSWORD);
    }
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (id) values ($1)", [id]);
      await client.query("commit");
      console.log(`${id}: applied`);
      applied++;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw new Error(`${id} failed, nothing from it was kept: ${e.message}`);
    }
  }
  console.log(applied ? `Done — ${applied} migration(s) applied.` : "Database is up to date.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
