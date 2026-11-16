# ClipCrew backend

Fastify + TypeScript API. It owns the database, logins and every rule (who can do what). The website
(the Next.js app in the repo root) has no database access: it calls this API.

```
Browser ──────────────► api.clipcrew.ignitralabs.com  (this service) ──► PostgreSQL
   │                              ▲
   └─► clipcrew.ignitralabs.com ──┘  (the website forwards the visitor's cookie when it renders pages)
```

## How it is organised

| Path | What |
|---|---|
| `src/routes/api/**/route.ts` | One file per URL (`[id]` = `:id`). Each exports `GET/POST/PATCH/DELETE(req: Request, { params })`. `npm run gen` turns this folder into `src/routes.generated.ts` (run automatically before dev/build/typecheck). |
| `src/routes/api/pages/**` | Read endpoints that hold the data each admin/portal page needs. |
| `src/lib/portal/` | Sessions, permissions (`guard()`), money, weeks, password hashing (scrypt), reel-URL checks. |
| `src/db/` | `pool.ts` (connection pool + number/date parsing), `query.ts` (a small query builder: `.from(t).select().eq()…`, running parameterised SQL). |
| `src/loaders/` | Shared multi-query loaders used by route files. |
| `db/migrations/*.sql` + `db/migrate.mjs` | The database schema, applied in order. |
| `scripts/` | `create-super-admin.mjs`, `e2e.mjs` (tests), `e2e-clean.mjs`, `migrate-from-supabase.mjs` (one-off). |

Security model: logins are scrypt-hashed; the session cookie holds a random token whose SHA-256 is stored in
`sessions`; the cookie is `HttpOnly; Secure; SameSite=Lax`. State-changing requests must carry an `Origin` equal to
`FRONTEND_ORIGIN` (CSRF defence in depth). Every route calls `guard(...)`; staff are also limited to their campaigns.

## Run locally

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL etc.
npm run migrate                # needs DATABASE_URL (an owner URL) [+ APP_DB_PASSWORD for migration 0002]
npm run dev                    # http://localhost:4000
```

## Database

```bash
# owner/superuser URL; APP_DB_PASSWORD becomes the password of the limited clipcrew_app user
DATABASE_URL=postgres://postgres:...@host:5432/postgres APP_DB_PASSWORD=... npm run migrate

# first super admin (prints the password once)
DATABASE_URL=... node scripts/create-super-admin.mjs <loginId> "Full Name"
```

Turn on scheduled backups for the database in Coolify. Production connects as `clipcrew_app` (insert/update/delete/select only).

## Tests

`scripts/e2e.mjs` drives the real API (and optionally every page through the website). **It only runs against a
database whose name contains "test"** and deletes everything it creates.

```bash
# 1) a test database with the schema:   create database clipcrew_test;  then: npm run migrate (against it)
# 2) a super admin in it:               node scripts/create-super-admin.mjs e2eadmin "E2E Admin"
# 3) backend running against it:        tsx --env-file=.env.test src/server.ts
SUPER_LOGIN=e2eadmin SUPER_PW=... node --env-file=.env.test scripts/e2e.mjs
# optional: also test the pages through a running website
FRONTEND_URL=http://localhost:3000 SUPER_LOGIN=... SUPER_PW=... node --env-file=.env.test scripts/e2e.mjs
```

## Deploy (Coolify)

New resource → this GitHub repo → **Base Directory `/backend`** → Nixpacks (build `npm run build`, start `npm start`),
port `4000`, domain `api.<your site>`, and the variables from `.env.example`.
