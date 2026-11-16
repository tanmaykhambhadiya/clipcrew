// One-off: copy all data from the old Supabase project into the self-hosted Postgres, then give every
// user a fresh password (Supabase password hashes can't be read through its API). The new passwords are
// written to backend/.migration-passwords.local (git-ignored), never printed.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... node scripts/migrate-from-supabase.mjs
import { randomBytes, randomInt, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import pg from "pg";

const JSON_COLUMNS = { audit_log: ["before", "after"] };

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL.");
  process.exit(1);
}

// Parents before children so foreign keys are satisfied.
const TABLES = [
  "profiles", "campaigns", "campaign_staff", "campaign_clippers", "social_accounts", "campaign_accounts",
  "weekly_views", "fines", "notifications", "payouts", "audit_log", "waitlist", "contact_messages",
];

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

// Same format as lib/portal/password.ts hashPassword().
function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newPassword = () => Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
try {
  const { rows: [{ n }] } = await db.query("select count(*)::int as n from profiles");
  if (n > 0) throw new Error("The new database already has users — refusing to copy twice.");

  await db.query("begin");
  const passwords = [];
  for (const table of TABLES) {
    const rows = await fetchAll(table);
    if (!rows.length) { console.log(`${table.padEnd(18)} 0`); continue; }
    // profiles reference each other (created_by): insert without it, then fill it in.
    const data = table === "profiles" ? rows.map((r) => ({ ...r, created_by: null })) : rows;
    const cols = Object.keys(data[0]);
    for (const row of data) {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return null;
        // jsonb columns are always sent as JSON text (a JS array would otherwise become a Postgres array)
        if (JSON_COLUMNS[table]?.includes(c)) return JSON.stringify(v);
        return typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v;
      });
      await db.query(
        `insert into ${table} (${cols.map((c) => `"${c}"`).join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
        vals,
      );
    }
    if (table === "profiles") {
      for (const r of rows) {
        if (r.created_by) await db.query("update profiles set created_by = $1 where id = $2", [r.created_by, r.id]);
        const pw = newPassword();
        await db.query("insert into credentials (user_id, password_hash) values ($1, $2)", [r.id, hashPassword(pw)]);
        passwords.push({ loginId: r.login_id, role: r.role, status: r.status, password: pw });
      }
    }
    console.log(`${table.padEnd(18)} ${rows.length}`);
  }
  await db.query("commit");

  // Passwords go to a private, git-ignored file — never to the terminal or logs.
  const lines = passwords.map((p) => `${p.loginId.padEnd(16)} ${p.password}   (${p.role}${p.status !== "active" ? ", " + p.status : ""})`);
  writeFileSync(new URL("../.migration-passwords.local", import.meta.url), ["New passwords — share each with its owner, then delete this file.", "", ...lines, ""].join("\n"));
  console.log(`\nAll data copied. New passwords for ${passwords.length} user(s) saved to backend/.migration-passwords.local`);
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error("Copy failed, nothing was written:", e.message);
  process.exit(1);
} finally {
  await db.end();
}
