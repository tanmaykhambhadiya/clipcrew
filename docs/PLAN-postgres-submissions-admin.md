# ARCHITECTURE DECISION (supersedes Phase 1 below): separate frontend and backend

Decided with the owner (Nov 2026):

| Part | What | Domain | Deploy |
|---|---|---|---|
| Frontend | the existing Next.js app: **no database access, no secrets** | `clipcrew.ignitralabs.com` | Coolify resource 1 (repo root, as today) |
| Backend | new **Fastify + TypeScript** service in `backend/`: owns business logic, auth and the database | `api.clipcrew.ignitralabs.com` | Coolify resource 2 (**Base Directory = /backend**) |
| Database | the self-hosted Postgres | internal only | same Coolify server |

Supabase is removed completely (code, env vars, packages; the one-off copy script after it has been used). No PostgREST.

**How the split works (keeps risk low):**
- The backend reuses the existing route files almost verbatim. They already export `GET/POST/PATCH/DELETE(req: Request, { params })` and return web `Response`s. The backend loads `backend/src/routes/**/route.ts` with a Next-style file-system router (`[id]` becomes `:id`), converts each Fastify request into a web `Request`, and runs the handler inside an AsyncLocalStorage context that gives `cookies()` a request-scoped cookie jar. To port a route: copy the file, replace `NextResponse` with `Response`, and fix imports.
- Pages that read the database directly today become backend **read endpoints**; the frontend pages fetch them (server components forward the visitor's cookie, client components use `credentials: "include"`).
- **Auth/cookies:** the backend sets `cc_session` (HttpOnly, Secure, SameSite=Lax, `Domain=clipcrew.ignitralabs.com` in production so both hosts see it; host-only in dev). The frontend middleware only checks that the cookie exists; the backend validates it.
- **CORS/CSRF:** the backend allows only `FRONTEND_ORIGIN`, with credentials, and rejects state-changing requests whose Origin header isn't `FRONTEND_ORIGIN`.
- **Env:** frontend gets `NEXT_PUBLIC_API_URL` (browser) and `API_URL` (server-side; may be the internal URL). Backend gets `DATABASE_URL`, `FRONTEND_ORIGIN`, `COOKIE_DOMAIN`, `PORT`.

**Build order:** (1) backend scaffold + DB layer + runtime shims, (2) port all API routes, (3) page read endpoints + frontend refactor page by page, (4) new features (Phases 3 and 4 below, built in backend + frontend), (5) e2e tests, (6) cut-over.

In the phases below, read `app/api/...` as `backend/src/routes/...` and `getSupabaseAdmin()` as the backend DB adapter.

---


# Implementation plan: direct Postgres, clip submissions, easier admin

Written for the engineer or agent who builds this. Work on branch `self-hosted-db`, and do the phases
in order. Commit after each phase. **Do not merge to `main` or push to `main` until the owner approves
the cut-over (Phase 6).** `main` is live in production, on Coolify, and still uses Supabase.

---

## 0. Where things stand (read first)

| Item | State |
|---|---|
| Live site (`main`) | Next.js 14 app on Coolify. Server `62.84.182.141` (Contabo, FR). Data in **Supabase** (free tier, Mumbai). |
| Branch `self-hosted-db` | Supabase Auth replaced by own login: scrypt hashes in `credentials`, hashed session tokens in `sessions`, cookie `cc_session`. `lib/supabase.ts` currently talks to **PostgREST**. **We are dropping PostgREST.** The owner can't run extra containers, so the app connects to Postgres directly. |
| New Postgres | `postgres://postgres:<pw>@62.84.182.141:5485/postgres`. PostgreSQL 18, publicly reachable. `db/setup.mjs` has already run, so all tables exist (`db/schema.sql`), plus roles `anon`, `service_role` and `authenticator`, which are no longer needed. **No data yet.** |
| Live data | Still in Supabase: 3 users (`tanmay`, `veer123`, `bhavya`), 2 campaigns and a few rows. Copied in Phase 6. |
| `.env.local` | Has old Supabase keys. `POSTGREST_URL` currently holds the **Postgres URL**: the owner pasted it there. Rename it to `DATABASE_URL`. |
| Query style | ~200 calls in 46 files use the PostgREST/Supabase builder (`db.from(t).select().eq()...`). Only ~10 call sites use joins or `or()` strings (listed in §2.3). |
| Tests | The old 75-check e2e script lived in a temp folder and is **gone**. Recreate it in the repo (Phase 5). |
| Permission sandbox | Printing secrets to the terminal and running downloaded binaries were **blocked**. Write secrets and passwords to git-ignored `*.local` files and never echo them. |

Commands: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx next start -p 3300`.

---

## Phase 1: Direct Postgres connection (replace PostgREST)

### 1.1 Connection pool: `lib/db/pool.ts` (server-only)
- Use `pg` (already installed) and add `@types/pg` if it's missing. Create one `pg.Pool` stored on `globalThis` so dev hot reload doesn't leak pools.
- Read `process.env.DATABASE_URL`. Settings: `max: 10`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 10_000`, `application_name: "clipcrew-web"`, and `statement_timeout: 15_000` (pool `options` or `SET` on connect).
- SSL only when the URL has `sslmode=require`. Coolify's internal network has no TLS.
- **Type parsers.** These are critical, because the code was written against PostgREST JSON:
  - `int8` (OID 20) → `Number`. Every money and views column is bigint, and the code does arithmetic on them.
  - `numeric` (1700) → `Number`.
  - `date` (1082) → the **raw string** `YYYY-MM-DD`. By default pg turns it into a JS `Date`, which breaks `week_start`, `paid_on`, `starts_on` and similar fields.
  - `timestamptz` (1184) and `timestamp` (1114) → an ISO string (`new Date(v).toISOString()`).
  - `text[]`, `jsonb` and `uuid` are already fine by default.
- In `next.config.mjs`, add `experimental: { serverComponentsExternalPackages: ["pg"] }`.

### 1.2 Query builder: `lib/db/query.ts`
Build a small builder that is **compatible with how the code already calls PostgREST**, so most of the 46 files don't change. Export `getSupabaseAdmin()` and `getDb()` from `lib/supabase.ts`, returning `{ from(table) }` built on this. Keep the name so the call sites stay untouched.

It must be **thenable** (`await q`) and resolve to `{ data, error, count }`, never throwing for SQL errors. `error` is `{ code, message, details }`, and `code` is the Postgres SQLSTATE: the code checks `error.code === "23505"` for unique violations. It must also allow `let q = ...; if (x) q = q.eq(...)`, so chain methods return the same builder.

Support **exactly** this subset, and throw an `Error("unsupported: …")` on anything else so gaps show up loudly:

| Method | SQL |
|---|---|
| `select(cols = "*", { count?: "exact", head?: boolean })` | Plain comma list of columns or `*`. Validate each name with `/^[a-z_][a-z0-9_]*$/` and quote it. **Throw if the string contains `(`, `:` or `!`.** Those are the joins in §2.3, rewritten by hand. `count:"exact"` → `count(*) over()` or a separate count query. `head:true` → no rows, `data: null`, only `count`. |
| `eq, neq, gt, gte, lt, lte` | `col = $n` and so on |
| `in(col, arr)` | `col = any($n)`. **An empty array means zero rows: return `data: []` without querying**, as PostgREST does. |
| `is(col, null)` | `col is null` |
| `not(col, "is", null)` | `col is not null` (the only `not` form used) |
| `ilike(col, pattern)` | `col ilike $n`. Callers pass `%term%`. |
| `contains(col, arr)` | `col @> $n` (array) |
| `order(col, { ascending = true, nullsFirst })` | Several calls append, in order |
| `range(from, to)` | `limit to-from+1 offset from` |
| `limit(n)` | `limit n` |
| `single()` | Error code `PGRST116` unless exactly 1 row. `data` = that row. |
| `maybeSingle()` | `data` = the row or `null`. Error if more than 1 row. |
| `insert(obj or array)` | Columns from the union of keys. Arrays and objects are bound as params. `jsonb` columns get `JSON.stringify` for plain objects (see the `audit_log` before/after fields). Without `.select()`, `data` is `null`. |
| `.select(cols)` after insert/update/delete/upsert | `returning <cols>` |
| `update(obj)` + filters | `update … set … where …` (an update with no filter → throw) |
| `delete()` + filters | `delete … where …` (a delete with no filter → throw) |
| `upsert(obj or array, { onConflict?: "a,b", ignoreDuplicates?: boolean })` | `insert … on conflict (cols) do update set <non-conflict cols> = excluded.<col>`, or `do nothing`. If `onConflict` is omitted, use the table's primary key from a static map in `lib/db/keys.ts` (`credentials: user_id`, `weekly_views: id`, …). |

Table names come from code only. Still validate them against an allow-list of known tables.

### 1.3 Hand-rewrite the complex call sites as SQL
Add `lib/db/sql.ts`, exporting `query<T>(text, params): Promise<T[]>` and `queryOne<T>(…)` on the pool. Rewrite these and keep **the same return shapes** the surrounding code expects:

1. **`lib/portal/session.ts` → `getMe`**
   ```sql
   select s.expires_at, p.id, p.login_id, p.full_name, p.role, p.status, p.permissions
   from sessions s join profiles p on p.id = s.user_id where s.token_hash = $1
   ```
2. **`app/api/auth/login/route.ts`**: profile plus `credentials.password_hash` via `left join credentials c on c.user_id = p.id`.
3. **`app/admin/accounts/query.ts`**: a join to `profiles` as clipper and a second join as verifier (`left join profiles v on v.id = a.verified_by`). Search: `(a.username ilike $q or cp.full_name ilike $q or cp.login_id ilike $q)`. Keep the 300-row cap and the output shape `{ …, clipper: {…}, verifier: {…} | null }`.
4. **`app/api/admin/campaigns/[id]/clippers/route.ts`** (GET search): `(login_id ilike $1 or full_name ilike $1)`.
5. **`app/api/admin/fines/route.ts`**: the scope string `campaign_id.in.(…),campaign_id.is.null` becomes `(campaign_id = any($ids) or campaign_id is null)`. `status === "waived"` → `waived_at is not null`.
6. **`app/api/admin/rejections/route.ts`**: scope `(campaign_id = any($ids) or (campaign_id is null and kind = 'fine'))`, plus `created_by is not null`. Look at `scopeFilter()` (used by both routes) and replace it with a function that returns a SQL fragment and params.
7. **`app/portal/inbox/load.ts`**: keyset paging. `where clipper_id = $1 and (created_at < $2 or (created_at = $2 and id < $3)) order by created_at desc, id desc limit 51`.
8. **`app/portal/campaigns/data.ts`** and **`app/api/portal/campaigns/[id]/accounts/route.ts`**: `campaign_clippers join campaigns`, returning `{ joined_at, campaign: {...} }`.

**Sanitise every `ilike` term**: escape `%`, `_` and `\` in user input, and put the `%…%` around it in code.

### 1.4 Cleanup
- Remove `@supabase/postgrest-js`, and remove `POSTGREST_*` from `lib/supabase.ts`, `.env.example` and `db/README.md`.
- `.env.example` must contain only `DATABASE_URL=`, with a comment. The owner's edit left leading spaces there; fix them.
- In `.env.local`, rename `POSTGREST_URL` → `DATABASE_URL` and delete `POSTGREST_JWT_SECRET`. Keep the three Supabase keys until Phase 6 (the migration script needs them).
- Delete `.env.postgrest.local` (it holds PostgREST secrets that are no longer used).
- Update `db/README.md`: the app connects with `DATABASE_URL`, and PostgREST is not used.

**Acceptance:** `tsc`, `lint` and `build` pass. `grep -r "postgrest\|PGRST\|@supabase" app lib components` → nothing. Login, logout, every admin page and every portal page work against the new DB (Phase 5 test).

---

## Phase 2: Database migrations + least-privilege app user

1. Add `db/migrate.mjs`, a tiny runner:
   - It creates `schema_migrations(id text primary key, applied_at timestamptz default now())`, then applies `db/migrations/*.sql` in name order. Each file runs in its own transaction.
   - `node db/migrate.mjs` reads `DATABASE_URL`.
2. `db/migrations/0001_init.sql` is the current `db/schema.sql` **without** the PostgREST role block. Since 0001 is already applied on the live new DB, the runner must **mark it applied when `profiles` already exists**, instead of re-running it. After that, `db/schema.sql` → delete it, and `db/setup.mjs` → replace it with `migrate.mjs`.
3. `db/migrations/0002_app_role_cleanup.sql`:
   - `drop role if exists authenticator`. Revoke and drop `anon` and `service_role` after reassigning their grants.
   - `create role clipcrew_app login password :pw` (password supplied by the runner from env `APP_DB_PASSWORD`, never committed). Grant it `select, insert, update, delete` on all tables, `usage` on the schema, and default privileges for future tables.
   - Production `DATABASE_URL` uses `clipcrew_app`, **not** `postgres` (superuser).
4. Later migrations: 0003 (Phase 3) and 0004 (Phase 4).

---

## Phase 3: Clippers submit their clip URLs (new feature)

The owner wants clippers to submit the URL of each reel they post for a campaign. Staff review them. **Weekly views stay manual, per account** (unchanged). Submissions are for tracking and review.

### 3.1 Schema: `db/migrations/0003_submissions.sql`
```sql
create table submissions (
  id uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  url text not null,
  url_key text not null unique,        -- normalised URL (lowercase host, no query/hash, no trailing slash)
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  reject_reason text,
  fine_id uuid references fines(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on submissions (campaign_id, status, created_at desc);
create index on submissions (clipper_id, created_at desc);
-- new staff permission
alter table profiles drop constraint profiles_permissions_check;
alter table profiles add constraint profiles_permissions_check check (permissions <@ array[
  'users.create','accounts.verify','campaigns.manage','views.enter','rejections.send',
  'fines.create','payouts.manage','audit.view','export.data','submissions.review'
]);
```
Add `submissions.review` ("Review clip submissions") to `lib/portal/permissions.ts`.

### 3.2 Clipper side: `/portal/submissions` (add to the portal nav after Campaigns)
- **Form:**
  - Campaign: only campaigns they belong to with status `active`.
  - Account: only **their verified accounts linked to that campaign** (`campaign_accounts`).
  - Reel URL and an optional note (max 300).
- **Server validation:**
  - http(s) only.
  - The host must match the account's platform:
    - Instagram: `instagram.com/reel/…` or `/p/…`
    - YouTube: `youtube.com/shorts/…`, `watch?v=`, or `youtu.be/…`
    - TikTok: `tiktok.com/@…/video/…` or `vm.tiktok.com`
    - X: `x.com` or `twitter.com/…/status/…`
    - Facebook: `facebook.com` or `fb.watch`
    - `other`: any http(s)
  - Normalise to `url_key`. A duplicate gets a friendly message ("already submitted").
  - Rate limit: 100 submissions per clipper per day (count in the DB).
  - Verify membership and account ownership server-side.
- **List:** their submissions newest first, filterable by campaign and status. Each shows a status pill, the reject reason, and the link (http(s) only, `rel="noopener noreferrer"`).
  - A clipper may delete only their own **pending** submissions.
- **API:** `app/api/portal/submissions/route.ts` (GET, POST) and `[id]/route.ts` (DELETE). Every query is scoped to `me.id`.

### 3.3 Admin side: `/admin/submissions` (permission `submissions.review`, scoped by `staffCampaignIds`)
- **Queue:**
  - Tabs Pending (default, oldest first), Approved, Rejected and All, with counts.
  - Filters: campaign, clipper, account, date range. Search by URL or handle.
  - Each row: clipper, @account and platform, campaign, an "Open reel" link, submitted time, note.
- **Actions:**
  - **Approve**, which sends no notification (too noisy).
  - **Reject**, with a required reason and an optional fine (the fine needs `fines.create`). Reject must:
    - set the status;
    - insert a `fines` row if there's a fine;
    - send one `reel_rejected` notification with `reel_ref` = URL, the reason, and the fine line if any;
    - write an audit entry (`SUBMISSION_APPROVED` / `SUBMISSION_REJECTED`).
  - Reuse the logic from `app/api/admin/rejections/route.ts`, moved into a shared helper (`lib/portal/rejections.ts`).
- **Bulk:** checkboxes plus "Approve selected" (max 200 at a time, one statement, one audit entry).
- **Keyboard:** J/K move between rows, A approves, R opens reject. Optional; skip it if it gets complicated.
- **Weekly views grid** (`/admin/views`): add a read-only column, "Approved reels this week", per account (count of `submissions` with `status='approved'` and `created_at` in that IST week) to help staff.
- **CSV export:** add `type=submissions` to `/api/admin/export` (respect scoping and the formula-injection guard).
- Add activity labels for the new actions in `app/admin/activity/labels.ts`.

---

## Phase 4: Easier admin management + sharing notifications

### 4.1 Notices centre (replace and extend `/admin/rejections`, now labelled "Notices")
- **Tabs:** Send notice · Reel rejection · Fine · History.
- **Send notice:**
  - Audience is one of:
    - **Everyone**: all active clippers. Super admin only.
    - **Campaign(s)**: multi-select. Staff only see their campaigns. Needs `campaigns.manage`.
    - **Selected clippers**: multi-select search.
  - Fields: title, message, optional link (http(s)).
  - Preview, then "Send". Afterwards show "Copy text" and "Share on WhatsApp" (`https://wa.me/?text=` with title, message, link and portal URL).
- **Schema** (`0004_notice_batches.sql`):
  - `alter table notifications add column batch_id uuid; create index on notifications (batch_id);`
  - One send = one `batch_id` across all recipient rows, inserted with a single multi-row `insert`.
- **History:** grouped by `batch_id`. Columns: title, audience, sent by, when, **recipients**, **read** (count of `read_at is not null`), and **read %**. A "Re-share" button opens the WhatsApp text.

### 4.2 Clipper 360: `/admin/clippers` and `/admin/clippers/[id]` (permission `users.create`; staff only see clippers in their campaigns)
- **List:** search, status, number of verified/pending accounts, campaigns, pending submissions, balance (from `clipper_balances`), last login (latest `audit_log` LOGIN).
- **Detail page, one screen with sections:**
  - Profile: edit name, phone, UPI (`users.create`).
  - Login: reset password and share by WhatsApp. Terminate or reactivate (super admin).
  - Accounts: inline "Send code" and "Verify" (reuse `app/admin/accounts/AccountActions.tsx`).
  - Campaigns: add or remove, reusing the campaign clipper API.
  - Submissions: the latest 20, with approve/reject.
  - Earnings by week (last 12).
  - Fines (with waive for super admin) and payouts (record payout with `payouts.manage`).
  - Notices sent to them, plus a "Send message" box that sends to this one clipper.
  - Activity for this user (audit entries where `entity_id` = them or `actor_id` = them).
- Link clipper names everywhere in the admin (users, accounts, submissions, payouts) to this page.

### 4.3 "Needs attention" on `/admin` (top of the overview, only what the user may act on)
- Accounts waiting for a code (`status='pending' and verify_code=''`). Accounts with a code sent but not yet verified.
- Pending submissions.
- Active campaigns with **no weekly views entered for last week**.
- Clippers with a positive balance (for `payouts.manage`).
- Each one is a count with a link to the filtered page.

### 4.4 Nav badges (`app/admin/layout.tsx`)
- Show counts on **Accounts** (pending) and **Submissions** (pending), loaded with one SQL query using `count(*) filter (where …)` and scoped for staff.
- Add nav items: Clippers (`users.create`) and Submissions (`submissions.review`). Rename "Notices & fines" to "Notices".

### 4.5 Clipper inbox polish (`/portal/inbox`)
Show the link from announcements (stored in `reel_ref`) as a button. Group by day (Today, Yesterday, date).

---

## Phase 5: Tests (recreate in the repo)

Create `scripts/e2e.mjs`. It runs against `BASE` (default `http://localhost:3300`) with `DATABASE_URL` for direct checks, and reads `SUPER_PW` from env.
- It creates `e2e-*` users and an "E2E Test Campaign".
- It cleans up **only** rows it created, in `finally`, deleting with `pg`.

Each `Session` keeps its own cookie jar (`cc_session`). Send a distinct `x-forwarded-for` per session to avoid the login rate limit.

### Checks to include (the old suite had 75, plus the new ones)
- **Auth:**
  - Super login works. A wrong password gets the same message as an unknown login ID.
  - A clipper can't reach `/admin` or `/api/admin/*` (403). A staff member without `users.create` is redirected from `/admin/users`.
  - **Terminate cuts the session** on the next request. Reactivate lets them log in again.
  - Password change: a wrong current password is rejected. A reset ends the target's sessions.
- **Users:** create clipper and staff with permissions. A duplicate login ID → 409. Staff with `users.create` can create clippers only, and can't terminate.
- **Campaigns:** the super admin creates one. Staff can't change the rate. Assign staff and a clipper. A non-member clipper can't link accounts.
- **Accounts:**
  - Add from a URL; it's normalised with `verify_code` `''`. A duplicate is rejected.
  - Verify is blocked until a code is sent. A bad code is rejected. The code arrives in the clipper's inbox. Then verify works.
  - A clipper can't link someone else's account. An unverified account can't be linked.
- **Weekly views:**
  - Staff save views. Amount = `floor(views × rate / 1e6)`, e.g. 1,240,000 at ₹5,000 → ₹6,200, stored as **numbers**, and `week_start` comes back as the string `YYYY-MM-DD`.
  - Rejected: an unlinked account, a future week, a non-Monday.
- **Notices:** a rejection with a fine. A `javascript:` link and a non-member clipper are rejected. The balance view gives 6200 − 200 = 6000. A payout above the balance is rejected; ₹3,000 is recorded.
- **Inbox:** contains the info, account_verified, reel_rejected and payout kinds. Clipper 2 can't see clipper 1's items. Mark-all-read → 0 unread. Keyset "Load more" pages correctly (create 55 notices and check 50 + 5).
- **Submissions (new):**
  - A clipper submits a valid URL for their linked verified account.
  - Rejected: a URL for another platform, a duplicate, an account not linked to the campaign, a campaign they're not in.
  - Staff without `submissions.review` get 403.
  - Approve. Reject with a fine → notification plus fine row.
  - Bulk approve. CSV `type=submissions` contains the row.
- **Notices centre (new):** campaign broadcast → one batch with N recipients. Read counts update after the clipper reads. Only the super admin can send to "Everyone".
- **Pages:** every admin and portal page returns 200 for the right role with no error text: `/admin`, campaigns (list/new/detail), views, accounts, submissions, notices, payouts, users, clippers (list/detail), activity, settings; `/portal`, campaigns, submissions, accounts, wallet, inbox, settings; plus `/`, `/login`, `/privacy`, `/terms`.
- **Speed sanity:** print the time-to-first-byte of `/admin` and `/portal`. Against the real server they should be **< 1s** once app and DB share a server.

Also re-check **375px** for all admin and portal pages: no horizontal scroll (`documentElement.scrollWidth <= innerWidth`). Shared tables must use `TableWrap` from `components/portal/ui.tsx`, which is already `relative` to stop sr-only overflow.

---

## Phase 6: Data copy + cut-over (needs the owner, step by step)

1. The Supabase project must be **awake**: open the dashboard. If `curl …/rest/v1/waitlist` gives 404/521 or a DNS error, ask the owner to restore it.
2. Update `scripts/migrate-from-supabase.mjs`:
   - It must also copy the new tables' data where present (none for `submissions`).
   - **Write the new passwords to git-ignored `.migration-passwords.local` instead of printing them**, because printing secrets is blocked.
3. Run it against the **new** DB: `DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/migrate-from-supabase.mjs`. It refuses if users already exist; for a re-run, truncate first, with the owner's OK. Tell the owner the passwords file path.
4. Run `node db/migrate.mjs` (0002–0004).
5. In Coolify, on the **app**:
   - Add `DATABASE_URL` = the **internal** Postgres URL with user `clipcrew_app`. The internal host is shown on the Postgres resource; the public `62.84.182.141:5485` only works as a fallback.
   - Remove `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
6. With the owner's go-ahead, merge `self-hosted-db` → `main` and push. Coolify redeploys.
7. Smoke-test production:
   - Login as `tanmay` with the new password.
   - Open each admin page, waitlist POST, contact POST.
   - Run `scripts/e2e.mjs` against production only with the owner's OK (it creates and deletes `e2e-*` data).
8. Ask the owner to:
   - turn **off "Make it publicly available"** on the Postgres resource;
   - enable **scheduled backups** in Coolify;
   - pause or delete the Supabase project after a week.

---

## Decisions already made (don't re-ask)
- Direct `pg`, no PostgREST, no Supabase, no MongoDB.
- Login IDs and passwords are created by admins. Verification codes are typed by staff and sent to the clipper's inbox.
- Rate is ₹ per 1M views, set per campaign, and only the super admin can change it. Weekly views are entered per account per campaign as the views gained that week; amounts are calculated.
- Fines are typed manually. Rejected reels' views simply aren't counted.
- Payouts reduce the balance. Balance = earned − active fines − paid.

## Defaults to confirm with the owner (build them this way unless told otherwise)
- New permission `submissions.review` (not reusing `rejections.send`).
- Approving a submission sends no notification; rejecting does.
- "Notice to Everyone" is super admin only.
- 100 submissions per clipper per day.
- Clippers can delete only pending submissions.
