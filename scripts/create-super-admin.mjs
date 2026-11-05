// Creates the first super admin. Usage: node scripts/create-super-admin.mjs <loginId> "<Full Name>"
// Reads .env.local, generates a random password and prints it ONCE. Refuses to run if a super admin exists.
import { readFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [loginId, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim();
if (!loginId || !fullName || !/^[a-z0-9._-]{3,30}$/.test(loginId)) {
  console.error('Usage: node scripts/create-super-admin.mjs <loginId> "<Full Name>"  (login: 3–30 of a-z 0-9 . _ -)');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: lookupError } = await supabase.from("profiles").select("login_id").eq("role", "super_admin");
if (lookupError) {
  console.error("Couldn't reach the database:", lookupError.message);
  process.exit(1);
}
if (existing.length) {
  console.error(`A super admin already exists (${existing.map((e) => e.login_id).join(", ")}). Nothing changed.`);
  process.exit(1);
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const password = Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const { data: created, error: authError } = await supabase.auth.admin.createUser({
  email: `${loginId}@portal.ignitralabs.com`,
  password,
  email_confirm: true,
});
if (authError) {
  console.error("Couldn't create the login:", authError.message);
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").insert({
  id: created.user.id,
  login_id: loginId,
  full_name: fullName,
  role: "super_admin",
});
if (profileError) {
  await supabase.auth.admin.deleteUser(created.user.id);
  console.error("Couldn't save the profile:", profileError.message);
  process.exit(1);
}

console.log(`\nSuper admin created.\n  Login ID : ${loginId}\n  Password : ${password}\n\nSave this password now — it is not stored anywhere and can't be shown again.\n`);
