# Database (self-hosted)

ClipCrew runs on its own **PostgreSQL**, with **PostgREST** in front of it. PostgREST gives the app the
same query API it used with Supabase. Logins are handled by the app itself: passwords are hashed with
scrypt, and sessions live in the `sessions` table.

```
Next.js app ──(signed service token)──> PostgREST ──(authenticator role)──> PostgreSQL
```

## 1. Create the tables (once)

```bash
DATABASE_URL=postgres://postgres:...@host:port/postgres \
PGRST_AUTH_PASSWORD=<strong random password> \
node db/setup.mjs
```

This creates every table plus three roles:

| Role | Can do |
|---|---|
| `anon` | Nothing |
| `service_role` | Read and write everything |
| `authenticator` | The login PostgREST uses. Its password is `PGRST_AUTH_PASSWORD`. |

## 2. Run PostgREST (Coolify → New resource → Docker Image `postgrest/postgrest:v12.2.3`)

| Env var | Value |
|---|---|
| `PGRST_DB_URI` | `postgres://authenticator:<PGRST_AUTH_PASSWORD>@<postgres host>:<port>/postgres` |
| `PGRST_DB_SCHEMAS` | `public` |
| `PGRST_DB_ANON_ROLE` | `anon` |
| `PGRST_JWT_SECRET` | a random string of 32+ characters |

Expose port `3000`.

## 3. App environment

| Env var | Value |
|---|---|
| `POSTGREST_URL` | PostgREST's URL |
| `POSTGREST_JWT_SECRET` | same value as `PGRST_JWT_SECRET` |

## First super admin

```bash
DATABASE_URL=... node scripts/create-super-admin.mjs <loginId> "Full Name"
```

## Backups

Turn on scheduled backups for the PostgreSQL database in Coolify. The database is self-hosted now, so
backups are our responsibility.
