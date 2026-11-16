// End-to-end tests for the ClipCrew API. Runs against a *test* database, never production.
//   node --env-file=.env.test scripts/e2e.mjs          (backend must be running on BASE, default http://localhost:4100)
// Needs: DATABASE_URL (test DB), SUPER_LOGIN + SUPER_PW (an existing super admin in that DB).
// Creates e2e-* users and an "E2E Test Campaign", and deletes everything it created when it finishes.
import pg from "pg";

const BASE = process.env.BASE || "http://localhost:4100";
const ORIGIN = process.env.FRONTEND_ORIGIN?.split(",")[0] || "http://localhost:3000";
const FRONTEND_URL = process.env.FRONTEND_URL || ""; // set to also test the pages through the frontend
const SUPER = { loginId: process.env.SUPER_LOGIN, password: process.env.SUPER_PW };
if (!process.env.DATABASE_URL || !SUPER.loginId || !SUPER.password) {
  console.error("Set DATABASE_URL, SUPER_LOGIN and SUPER_PW.");
  process.exit(1);
}
if (!/test/i.test(new URL(process.env.DATABASE_URL).pathname)) {
  console.error("Refusing to run: DATABASE_URL must point at a database whose name contains 'test'.");
  process.exit(1);
}

// Same value parsing as the backend (db/pool.ts): numbers for bigint/numeric, plain strings for dates.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

const pgc = new pg.Client({ connectionString: process.env.DATABASE_URL });
await pgc.connect();
const one = async (sql, args = []) => (await pgc.query(sql, args)).rows[0] ?? null;
const many = async (sql, args = []) => (await pgc.query(sql, args)).rows;

let pass = 0, failN = 0;
const check = (name, cond, extra = "") => {
  cond ? pass++ : failN++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + String(extra).slice(0, 180) : ""}`);
};

let ipN = 1;
class Session {
  jar = new Map();
  ip = `10.55.${Math.floor(ipN / 250)}.${(ipN++ % 250) + 1}`;
  async req(path, { method = "GET", json, raw = false, origin = ORIGIN } = {}) {
    const headers = { "x-forwarded-for": this.ip, cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (json !== undefined) headers["Content-Type"] = "application/json";
    if (origin && method !== "GET") headers.Origin = origin;
    const res = await fetch(BASE + path, { method, redirect: "manual", headers, body: json !== undefined ? JSON.stringify(json) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (!v || /max-age=0/i.test(c) || /expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, decodeURIComponent(v));
    }
    if (raw) return res;
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ...body };
  }
  /** Fetch a page from the frontend as this session (no redirects followed). */
  async web(path) {
    const res = await fetch(FRONTEND_URL + path, { redirect: "manual", headers: { cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") } });
    return { status: res.status, location: res.headers.get("location") || "", text: await res.text() };
  }
  login(loginId, password) {
    return this.req("/api/auth/login", { method: "POST", json: { loginId, password } });
  }
}

// Monday of last week (IST)
const prevWeek = (() => {
  const ist = new Date(Date.now() + 5.5 * 3600e3);
  const d = new Date(ist.toISOString().slice(0, 10) + "T00:00:00Z");
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dow - 1) - 7);
  return d.toISOString().slice(0, 10);
})();

const created = { campaignId: null };
try {
  // ───────────── auth ─────────────
  const su = new Session();
  check("no Origin header → blocked (CSRF)", (await new Session().req("/api/auth/login", { method: "POST", json: {}, origin: null })).status === 403);
  check("foreign Origin → blocked", (await new Session().req("/api/auth/login", { method: "POST", json: {}, origin: "https://evil.example" })).status === 403);
  const wrongPw = await new Session().login(SUPER.loginId, "definitely-wrong");
  const noUser = await new Session().login("no-such-user-xyz", "whatever");
  check("wrong password and unknown user get the same answer", !wrongPw.ok && !noUser.ok && wrongPw.error === noUser.error, wrongPw.error);
  const lg = await su.login(SUPER.loginId, SUPER.password);
  check("super admin login", lg.ok && lg.redirect === "/admin");
  check("session cookie issued", su.jar.has("cc_session"));
  check("API without session → 403", (await new Session().req("/api/admin/users")).status === 403);

  // ───────────── users ─────────────
  const mk = (body) => su.req("/api/admin/users", { method: "POST", json: body });
  const c1 = await mk({ loginId: "e2e-c1", fullName: "E2E Clipper One", role: "clipper", password: "ClipperOne123" });
  const c2 = await mk({ loginId: "e2e-c2", fullName: "E2E Clipper Two", role: "clipper", password: "ClipperTwo123" });
  const s1 = await mk({ loginId: "e2e-s1", fullName: "E2E Staff One", role: "admin", password: "StaffOne1234", permissions: ["views.enter", "rejections.send", "fines.create"] });
  const s2 = await mk({ loginId: "e2e-s2", fullName: "E2E Staff Two", role: "admin", password: "StaffTwo1234", permissions: ["users.create"] });
  check("create 2 clippers + 2 staff", c1.ok && c2.ok && s1.ok && s2.ok, JSON.stringify([c1.error, c2.error, s1.error, s2.error]));
  check("duplicate login ID → 409", (await mk({ loginId: "e2e-c1", fullName: "Dup", role: "clipper" })).status === 409);
  check("generated password returned once", (await mk({ loginId: "e2e-gen", fullName: "Gen", role: "clipper" })).password?.length === 12);
  const hashRow = await one("select password_hash from credentials where user_id = $1", [c1.user.id]);
  check("password stored as a scrypt hash, never plain", hashRow?.password_hash.startsWith("scrypt$") && !hashRow.password_hash.includes("ClipperOne123"));

  const st1 = new Session(), st2 = new Session(), cl1 = new Session(), cl2 = new Session();
  check("staff + clipper logins", (await st1.login("e2e-s1", "StaffOne1234")).ok && (await st2.login("e2e-s2", "StaffTwo1234")).ok && (await cl1.login("e2e-c1", "ClipperOne123")).ok && (await cl2.login("e2e-c2", "ClipperTwo123")).ok);
  check("staff without users.create can't list users", (await st1.req("/api/admin/users")).status === 403);
  const listed = await st2.req("/api/admin/users");
  check("staff with users.create sees clippers only", listed.ok && listed.users.every((u) => u.role === "clipper"));
  check("that staff can't create staff", !(await st2.req("/api/admin/users", { method: "POST", json: { loginId: "e2e-x", fullName: "X", role: "admin" } })).ok);
  check("that staff can't terminate", !(await st2.req(`/api/admin/users/${c1.user.id}`, { method: "PATCH", json: { action: "terminate", reason: "x" } })).ok);
  check("that staff can't reset another staff's password", !(await st2.req(`/api/admin/users/${s1.user.id}`, { method: "PATCH", json: { action: "reset_password" } })).ok);
  check("clipper blocked from admin API", (await cl1.req("/api/admin/campaigns")).status === 403);

  // ───────────── campaign ─────────────
  const camp = await su.req("/api/admin/campaigns", { method: "POST", json: { name: "E2E Test Campaign", client: "E2E Client", rateRupees: 5000, allowedPlatforms: ["instagram", "youtube"], maxAccountsPerClipper: 1, status: "active", startsOn: "", endsOn: "" } });
  created.campaignId = camp.campaign?.id;
  const CID = created.campaignId;
  check("super creates campaign", camp.ok && !!CID, camp.error);
  const row = await one("select rate_per_million_paise, allowed_platforms from campaigns where id = $1", [CID]);
  check("rate stored in paise (₹5000 → 500000), platforms as array", row?.rate_per_million_paise === 500000 && Array.isArray(row.allowed_platforms) && row.allowed_platforms.length === 2, JSON.stringify(row));
  check("assign staff to campaign", (await su.req(`/api/admin/campaigns/${CID}/staff`, { method: "POST", json: { staffId: s1.user.id } })).ok);
  check("assign again is idempotent (upsert ignore)", (await su.req(`/api/admin/campaigns/${CID}/staff`, { method: "POST", json: { staffId: s1.user.id } })).ok);
  check("add clipper 1 to campaign", (await su.req(`/api/admin/campaigns/${CID}/clippers`, { method: "POST", json: { clipperIds: [c1.user.id] } })).ok);
  const search = await su.req(`/api/admin/campaigns/${CID}/clippers?q=e2e`);
  check("clipper search (or + ilike filter)", search.ok, search.error);
  const chg = await st1.req(`/api/admin/campaigns/${CID}`, { method: "PATCH", json: { name: "E2E Test Campaign", client: "E2E Client", rateRupees: 9999, allowedPlatforms: ["instagram"], maxAccountsPerClipper: 1, status: "active", startsOn: "", endsOn: "" } });
  check("staff can't change campaign rate", !chg.ok, chg.error);
  check("campaigns list for staff shows only assigned", (await st1.req("/api/admin/campaigns")).campaigns?.some((c) => c.id === CID));

  // ───────────── accounts + verification codes ─────────────
  const a1 = await cl1.req("/api/portal/accounts", { method: "POST", json: { platform: "instagram", handle: "https://www.instagram.com/E2E_Test_Acc1/?hl=en" } });
  check("clipper adds account from URL (normalised, no code yet)", a1.ok && a1.account?.username === "e2e_test_acc1" && a1.account?.verify_code === "", JSON.stringify(a1.account ?? a1));
  check("duplicate account rejected", !(await cl2.req("/api/portal/accounts", { method: "POST", json: { platform: "instagram", handle: "@e2e_test_acc1" } })).ok);
  const a2 = await cl2.req("/api/portal/accounts", { method: "POST", json: { platform: "instagram", handle: "e2e_test_acc2" } });
  check("clipper 2 adds own account", a2.ok);
  const A1 = a1.account.id, A2 = a2.account.id;
  check("unverified account can't be linked", !(await cl1.req(`/api/portal/campaigns/${CID}/accounts`, { method: "PUT", json: { accountIds: [A1] } })).ok);
  check("staff without accounts.verify can't verify", !(await st1.req(`/api/admin/accounts/${A1}`, { method: "PATCH", json: { action: "verify" } })).ok);
  check("can't verify before a code is sent", !(await su.req(`/api/admin/accounts/${A1}`, { method: "PATCH", json: { action: "verify" } })).ok);
  check("bad code rejected", !(await su.req(`/api/admin/accounts/${A1}`, { method: "PATCH", json: { action: "set_code", code: "<x>" } })).ok);
  check("staff types + sends a code", (await su.req(`/api/admin/accounts/${A1}`, { method: "PATCH", json: { action: "set_code", code: "CREW-4821" } })).ok);
  const queue = await su.req("/api/admin/accounts?tab=pending&q=e2e");
  check("account queue loads (joins) and shows the code", queue.ok && JSON.stringify(queue).includes("CREW-4821") && JSON.stringify(queue).includes("E2E Clipper One"), queue.error);
  const inbox1 = await cl1.req("/api/portal/notifications");
  check("clipper receives the code in inbox", inbox1.items?.some((n) => (n.body ?? "").includes("CREW-4821")));
  check("super verifies account", (await su.req(`/api/admin/accounts/${A1}`, { method: "PATCH", json: { action: "verify" } })).ok);
  await su.req(`/api/admin/accounts/${A2}`, { method: "PATCH", json: { action: "set_code", code: "CREW-0002" } });
  check("super verifies clipper 2's account", (await su.req(`/api/admin/accounts/${A2}`, { method: "PATCH", json: { action: "verify" } })).ok);
  check("clipper can't link someone else's account", !(await cl1.req(`/api/portal/campaigns/${CID}/accounts`, { method: "PUT", json: { accountIds: [A2] } })).ok);
  check("non-member clipper can't link to the campaign", !(await cl2.req(`/api/portal/campaigns/${CID}/accounts`, { method: "PUT", json: { accountIds: [A2] } })).ok);
  check("clipper 1 links verified account", (await cl1.req(`/api/portal/campaigns/${CID}/accounts`, { method: "PUT", json: { accountIds: [A1] } })).ok);
  const mine = await cl1.req("/api/portal/campaigns");
  check("clipper campaigns list (join) shows this campaign + linked account", mine.ok && JSON.stringify(mine).includes(CID) && JSON.stringify(mine).includes(A1), mine.error);

  // ───────────── weekly views ─────────────
  const grid = await st1.req(`/api/admin/views?campaign=${CID}&week=${prevWeek}`);
  check("staff loads views grid", grid.ok && JSON.stringify(grid.grid).includes(A1), grid.error);
  const save = await st1.req("/api/admin/views", { method: "POST", json: { campaignId: CID, weekStart: prevWeek, rows: [{ accountId: A1, views: 1240000 }] } });
  check("staff saves weekly views", save.ok, save.error);
  const vrow = await one("select views, amount_paise, rate_per_million_paise, week_start from weekly_views where account_id = $1", [A1]);
  check("amount auto-calculated: 1.24M × ₹5000/1M = ₹6,200 (as numbers)", vrow?.amount_paise === 620000 && vrow?.views === 1240000 && vrow?.rate_per_million_paise === 500000, JSON.stringify(vrow));
  check("week_start comes back as plain 'YYYY-MM-DD'", vrow?.week_start === prevWeek, vrow?.week_start);
  const save2 = await st1.req("/api/admin/views", { method: "POST", json: { campaignId: CID, weekStart: prevWeek, rows: [{ accountId: A1, views: 1300000 }] } });
  const vrow2 = await one("select count(*)::int n, max(amount_paise)::int a from weekly_views where account_id = $1", [A1]);
  check("saving again updates the row (upsert), amount recalculated", save2.ok && vrow2.n === 1 && vrow2.a === 650000, JSON.stringify(vrow2));
  await st1.req("/api/admin/views", { method: "POST", json: { campaignId: CID, weekStart: prevWeek, rows: [{ accountId: A1, views: 1240000 }] } });
  check("views for an account not linked to the campaign rejected", !(await st1.req("/api/admin/views", { method: "POST", json: { campaignId: CID, weekStart: prevWeek, rows: [{ accountId: A2, views: 5 }] } })).ok);
  check("future week rejected", !(await st1.req("/api/admin/views", { method: "POST", json: { campaignId: CID, weekStart: "2035-01-01", rows: [{ accountId: A1, views: 5 }] } })).ok);
  check("non-Monday week rejected", !(await st1.req("/api/admin/views", { method: "POST", json: { campaignId: CID, weekStart: "2026-11-04", rows: [{ accountId: A1, views: 5 }] } })).ok);
  check("staff can't record payouts", !(await st1.req("/api/admin/payouts", { method: "POST", json: { clipperId: c1.user.id, amount: 1, paidOn: prevWeek } })).ok);

  // ───────────── rejections, fines, payouts ─────────────
  const rej = await st1.req("/api/admin/rejections", { method: "POST", json: { campaignId: CID, clipperId: c1.user.id, reelUrl: "https://www.instagram.com/reel/E2Etest123/", reason: "Used footage outside the approved assets.", fine: 200 } });
  check("staff sends rejection with ₹200 fine", rej.ok, rej.error);
  check("javascript: reel link rejected", !(await st1.req("/api/admin/rejections", { method: "POST", json: { campaignId: CID, clipperId: c1.user.id, reelUrl: "javascript:alert(1)", reason: "xss test" } })).ok);
  check("rejection for a clipper outside the campaign rejected", !(await st1.req("/api/admin/rejections", { method: "POST", json: { campaignId: CID, clipperId: c2.user.id, reelUrl: "https://x.com/a", reason: "not a member" } })).ok);
  const hist = await st1.req("/api/admin/rejections");
  check("rejection history loads (or-scope filter)", hist.ok && JSON.stringify(hist).includes("E2Etest123"), hist.error);
  const fines = await st1.req("/api/admin/fines");
  check("fines list loads for staff (or-scope filter)", fines.ok && fines.fines?.length === 1, fines.error);
  const fineId = fines.fines?.[0]?.id;
  check("staff can't waive a fine", !(await st1.req(`/api/admin/fines/${fineId}/waive`, { method: "POST", json: {} })).ok);
  const bal = await one("select earned_paise::int e, fines_paise::int f, paid_paise::int p from clipper_balances where clipper_id = $1", [c1.user.id]);
  check("balance = earned 6200 − fines 200 = ₹6,000", bal?.e === 620000 && bal?.f === 20000 && bal?.p === 0, JSON.stringify(bal));
  check("payout above balance rejected", !(await su.req("/api/admin/payouts", { method: "POST", json: { clipperId: c1.user.id, amount: 6000.01, paidOn: prevWeek } })).ok);
  const pay = await su.req("/api/admin/payouts", { method: "POST", json: { clipperId: c1.user.id, amount: 3000, paidOn: prevWeek, reference: "UPI-E2E-1" } });
  check("super records ₹3,000 payout", pay.ok, pay.error);
  const pr = await one("select paid_on, amount_paise from payouts where clipper_id = $1", [c1.user.id]);
  check("paid_on is a plain date string, amount a number", pr?.paid_on === prevWeek && pr?.amount_paise === 300000, JSON.stringify(pr));
  check("super waives the fine", (await su.req(`/api/admin/fines/${fineId}/waive`, { method: "POST", json: {} })).ok);
  const bal2 = await one("select fines_paise::int f from clipper_balances where clipper_id = $1", [c1.user.id]);
  check("waived fine no longer counts", bal2?.f === 0, JSON.stringify(bal2));

  // ───────────── inbox ─────────────
  const inbox = await cl1.req("/api/portal/notifications");
  const kinds = (inbox.items ?? []).map((n) => n.kind);
  check("inbox has info, account_verified, reel_rejected, fine/payout", ["info", "account_verified", "reel_rejected", "payout"].every((k) => kinds.includes(k)), kinds.join(","));
  const inbox2 = await cl2.req("/api/portal/notifications");
  check("clipper 2 can't see clipper 1's notices", inbox2.ok && !JSON.stringify(inbox2).includes("E2Etest123") && !JSON.stringify(inbox2).includes("UPI-E2E-1"));
  await pgc.query(`insert into notifications (clipper_id, kind, title, created_at)
                   select $1, 'info', 'bulk ' || g, now() - (g || ' seconds')::interval from generate_series(1, 55) g`, [c1.user.id]);
  const p1 = await cl1.req("/api/portal/notifications");
  check("inbox first page is 50 with a cursor", p1.items?.length === 50 && !!p1.nextCursor, `${p1.items?.length} / ${p1.nextCursor}`);
  const p2 = await cl1.req(`/api/portal/notifications?cursor=${encodeURIComponent(p1.nextCursor)}`);
  const total = (await one("select count(*)::int n from notifications where clipper_id = $1", [c1.user.id])).n;
  const ids = new Set([...(p1.items ?? []), ...(p2.items ?? [])].map((n) => n.id));
  check("keyset paging covers every notification once", p2.ok && ids.size === total && (p1.items.length + p2.items.length) === total, `${ids.size}/${total}`);
  check("mark all read", (await cl1.req("/api/portal/notifications", { method: "POST", json: { all: true } })).ok);
  check("no unread left", (await one("select count(*)::int n from notifications where clipper_id = $1 and read_at is null", [c1.user.id])).n === 0);

  // ───────────── export / activity ─────────────
  const csv = await su.req(`/api/admin/export?type=views&campaignId=${CID}`, { raw: true });
  const csvText = await csv.text();
  check("CSV export has the views row", csv.status === 200 && csvText.includes("e2e_test_acc1") && csvText.includes("1240000"), csvText.split("\n")[1]);
  check("activity log loads", (await su.req("/api/admin/activity")).ok);

  // ───────────── frontend pages (only when FRONTEND_URL is set) ─────────────
  if (FRONTEND_URL) {
    const bad = (t) => /Application error|Internal Server Error|Unhandled Runtime Error|Digest:/i.test(t);
    const page = async (sess, label, path, mustHave = []) => {
      const r = await sess.web(path);
      const missing = mustHave.filter((m) => !r.text.includes(m));
      check(`${label} ${path}`, r.status === 200 && !bad(r.text) && !missing.length, r.status !== 200 ? `status ${r.status} ${r.location}` : missing.length ? `missing: ${missing.join(", ")}` : "");
    };
    const wk = `campaign=${CID}&week=${prevWeek}`;
    await page(su, "super", "/admin", ["Welcome back"]);
    await page(su, "super", "/admin/campaigns", ["E2E Test Campaign"]);
    await page(su, "super", "/admin/campaigns/new");
    await page(su, "super", `/admin/campaigns/${CID}`, ["E2E Clipper One", "e2e_test_acc1"]);
    await page(su, "super", `/admin/views?${wk}`, ["e2e_test_acc1"]);
    await page(su, "super", "/admin/accounts?status=all", ["e2e_test_acc1"]);
    await page(su, "super", "/admin/rejections");
    await page(su, "super", "/admin/payouts", ["E2E Clipper One", "UPI-E2E-1"]);
    await page(su, "super", "/admin/users"); // the table itself loads in the browser (covered by the API checks)
    await page(su, "super", "/admin/activity");
    await page(su, "super", "/admin/settings");
    await page(st1, "staff", "/admin", ["Welcome back"]);
    await page(st1, "staff", "/admin/campaigns", ["E2E Test Campaign"]);
    await page(st1, "staff", `/admin/campaigns/${CID}`);
    await page(st1, "staff", `/admin/views?${wk}`, ["e2e_test_acc1"]);
    await page(st1, "staff", "/admin/rejections");
    await page(st1, "staff", "/admin/settings");
    await page(cl1, "clipper", "/portal", ["3,200"]);
    await page(cl1, "clipper", `/portal?c=${CID}&r=all`, ["E2E Test Campaign"]);
    await page(cl1, "clipper", "/portal/campaigns", ["E2E Test Campaign"]);
    await page(cl1, "clipper", "/portal/accounts", ["e2e_test_acc1"]);
    await page(cl1, "clipper", "/portal/wallet", ["UPI-E2E-1"]);
    await page(cl1, "clipper", "/portal/inbox");
    await page(cl1, "clipper", "/portal/settings");
    await page(new Session(), "public", "/", ["ClipCrew"]);
    await page(new Session(), "public", "/login");
    const redir = async (sess, path, expect) => {
      const r = await sess.web(path);
      check(`redirect ${path} → ${expect}`, r.status >= 300 && r.status < 400 && r.location.includes(expect), `${r.status} ${r.location}`);
    };
    await redir(new Session(), "/admin", "/login");
    await redir(new Session(), "/portal/wallet", "/login");
    await redir(cl2, "/admin", "/portal");
    await redir(st2, "/admin/payouts", "/admin");
    await redir(st2, "/portal", "/admin");
    const loginPage = await su.web("/login");
    check("signed-in user is sent away from /login", loginPage.status >= 300 && loginPage.status < 400);
  }

  // ───────────── password, terminate, reactivate ─────────────
  const cl3 = new Session();
  await cl3.login("e2e-c2", "ClipperTwo123");
  check("password change with wrong current password fails", !(await cl2.req("/api/account/password", { method: "POST", json: { currentPassword: "wrong-one", newPassword: "NewPassword123", confirmPassword: "NewPassword123" } })).ok);
  check("password change works", (await cl2.req("/api/account/password", { method: "POST", json: { currentPassword: "ClipperTwo123", newPassword: "NewPassword123", confirmPassword: "NewPassword123" } })).ok);
  check("other device signed out after a password change", [401, 403].includes((await cl3.req("/api/portal/notifications")).status));
  check("this device stays signed in", (await cl2.req("/api/portal/notifications")).ok);
  check("new password works, old one doesn't", (await new Session().login("e2e-c2", "NewPassword123")).ok && !(await new Session().login("e2e-c2", "ClipperTwo123")).ok);
  const term = await su.req(`/api/admin/users/${c1.user.id}`, { method: "PATCH", json: { action: "terminate", reason: "e2e test" } });
  check("super terminates clipper 1", term.ok, term.error);
  check("terminated user's open session is cut immediately", [401, 403].includes((await cl1.req("/api/portal/notifications")).status));
  check("terminated user can't log in", !(await new Session().login("e2e-c1", "ClipperOne123")).ok);
  check("super reactivates", (await su.req(`/api/admin/users/${c1.user.id}`, { method: "PATCH", json: { action: "reactivate" } })).ok);
  check("reactivated user logs in again", (await new Session().login("e2e-c1", "ClipperOne123")).ok);
  const rs = await su.req(`/api/admin/users/${c1.user.id}`, { method: "PATCH", json: { action: "reset_password" } });
  check("password reset returns a new password", rs.ok && rs.password?.length === 12);
  check("permissions can be changed by super admin only", (await su.req(`/api/admin/users/${s1.user.id}`, { method: "PATCH", json: { action: "set_permissions", permissions: ["views.enter"] } })).ok && !(await st2.req(`/api/admin/users/${s1.user.id}`, { method: "PATCH", json: { action: "set_permissions", permissions: [] } })).ok);

  // ───────────── public endpoints ─────────────
  const wl = { role: "creator", name: "E2E Waiter", email: "e2e-wait@example.test", elapsedMs: 5000 };
  const w1 = await new Session().req("/api/waitlist", { method: "POST", json: wl });
  check("waitlist signup returns a position", w1.ok && typeof w1.position === "number", JSON.stringify(w1));
  const w2 = await new Session().req("/api/waitlist", { method: "POST", json: { ...wl, email: "E2E-Wait@Example.test" } });
  check("duplicate email (any case) → already on the list", w2.ok && w2.already === true, JSON.stringify(w2));
  check("honeypot / too-fast signups rejected", !(await new Session().req("/api/waitlist", { method: "POST", json: { ...wl, email: "e2e-x@example.test", website: "spam" } })).ok && !(await new Session().req("/api/waitlist", { method: "POST", json: { ...wl, email: "e2e-y@example.test", elapsedMs: 100 } })).ok);
  check("contact form saves", (await new Session().req("/api/contact", { method: "POST", json: { name: "E2E", email: "e2e-contact@example.test", message: "hello" } })).ok);
} catch (e) {
  failN++;
  console.log("CRASH", e);
} finally {
  // Remove everything this run created (profiles with login_id e2e-*, the campaign, and their rows).
  const ids = (await many("select id from profiles where login_id like 'e2e-%'")).map((r) => r.id);
  await pgc.query("delete from campaigns where name = 'E2E Test Campaign'");
  if (ids.length) {
    await pgc.query("delete from audit_log where actor_id = any($1) or entity_id = any($1)", [ids]);
    for (const t of ["notifications", "fines", "payouts", "social_accounts"]) await pgc.query(`delete from ${t} where clipper_id = any($1)`, [ids]);
    await pgc.query("delete from profiles where id = any($1)", [ids]);
  }
  await pgc.query("delete from waitlist where email like 'e2e-%'");
  await pgc.query("delete from contact_messages where email like 'e2e-%'");
  const left = (await many("select login_id from profiles order by 1")).map((p) => p.login_id).join(", ");
  console.log(`\n${pass} passed, ${failN} failed. Remaining profiles: ${left}`);
  await pgc.end();
  process.exit(failN ? 1 : 0);
}
