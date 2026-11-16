// Removes everything scripts/e2e.mjs created (use after a KEEP=1 run).
//   node --env-file=.env.test scripts/e2e-clean.mjs
import pg from "pg";

if (!process.env.DATABASE_URL || !/test/i.test(new URL(process.env.DATABASE_URL).pathname)) {
  console.error("Refusing to run: DATABASE_URL must point at a database whose name contains 'test'.");
  process.exit(1);
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const ids = (await c.query("select id from profiles where login_id like 'e2e-%'")).rows.map((r) => r.id);
await c.query("delete from campaigns where name = 'E2E Test Campaign'");
if (ids.length) {
  await c.query("delete from audit_log where actor_id = any($1) or entity_id = any($1)", [ids]);
  for (const t of ["submissions", "notifications", "fines", "payouts", "social_accounts"]) {
    await c.query(`delete from ${t} where clipper_id = any($1)`, [ids]);
  }
  await c.query("delete from profiles where id = any($1)", [ids]);
}
await c.query("delete from waitlist where email like 'e2e-%'");
await c.query("delete from contact_messages where email like 'e2e-%'");
console.log(`cleaned ${ids.length} e2e users`);
await c.end();
