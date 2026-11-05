// Creates the first super admin. Usage: DATABASE_URL=postgres://... node scripts/create-super-admin.mjs <loginId> "<Full Name>"
// Generates a random password and prints it ONCE. Refuses to run if a super admin already exists.
import { randomBytes, randomInt, scryptSync } from "node:crypto";
import pg from "pg";

const [loginId, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim();
if (!process.env.DATABASE_URL || !loginId || !fullName || !/^[a-z0-9._-]{3,30}$/.test(loginId)) {
  console.error('Usage: DATABASE_URL=... node scripts/create-super-admin.mjs <loginId> "<Full Name>"  (login: 3–30 of a-z 0-9 . _ -)');
  process.exit(1);
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const password = Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
// Same format as lib/portal/password.ts hashPassword().
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$16384$8$1$${salt.toString("base64url")}$${hash.toString("base64url")}`;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  const { rows: existing } = await db.query("select login_id from profiles where role = 'super_admin'");
  if (existing.length) {
    console.error(`A super admin already exists (${existing.map((e) => e.login_id).join(", ")}). Nothing changed.`);
    process.exit(1);
  }
  await db.query("begin");
  const { rows } = await db.query("insert into profiles (login_id, full_name, role) values ($1, $2, 'super_admin') returning id", [loginId, fullName]);
  await db.query("insert into credentials (user_id, password_hash) values ($1, $2)", [rows[0].id, passwordHash]);
  await db.query("commit");
  console.log(`\nSuper admin created.\n  Login ID : ${loginId}\n  Password : ${password}\n\nSave this password now — it is not stored anywhere and can't be shown again.\n`);
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error("Couldn't create the super admin:", e.message);
  process.exit(1);
} finally {
  await db.end();
}
