# Deploying ClipCrew (two services + a database)

| Service | Where | Domain | Coolify settings |
|---|---|---|---|
| **Backend** (`backend/`) | Coolify, same server as the database | `api.clipcrew.ignitralabs.com` | Base Directory `/backend`, Nixpacks, port `4000` |
| **Frontend** (repo root) | Coolify | `clipcrew.ignitralabs.com` | Base Directory `/`, Nixpacks, port `3000` |
| **Database** | Coolify PostgreSQL | not public | scheduled backups ON |

Both domains must share the parent (`clipcrew.ignitralabs.com`) so the login cookie works on both.

## Environment variables

**Backend** — see `backend/.env.example`

| Variable | Value |
|---|---|
| `DATABASE_URL` | the **internal** Postgres URL for user `clipcrew_app` |
| `FRONTEND_ORIGIN` | `https://clipcrew.ignitralabs.com` |
| `COOKIE_DOMAIN` | `clipcrew.ignitralabs.com` |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `SECRET_KEY` | a long random string (40+ characters). Lets the super admin view clipper passwords. Don't change it later, or saved passwords can't be shown (reset them to fix). |

**Frontend** — see `.env.example`

| Variable | Value | Note |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.clipcrew.ignitralabs.com` | **tick "Build Variable"** — it is baked into the browser code |
| `API_URL` | the internal backend address if there is one, otherwise the same public URL | read when pages are rendered |

Delete the old `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and any `POSTGREST_*` variables.

## First-time cut-over from Supabase (do in this order)

1. **DNS:** add an `A` record `api.clipcrew` → the server's IP.
2. **Database schema** (from your PC, with the *owner* URL of the production Postgres):
   ```bash
   cd backend && npm install
   DATABASE_URL='postgres://postgres:…@HOST:PORT/postgres' APP_DB_PASSWORD='<new strong password>' npm run migrate
   ```
   `APP_DB_PASSWORD` becomes the password of the limited `clipcrew_app` user used by the backend.
3. **Wake Supabase** (free projects pause when idle): dashboard → *Restore project*.
4. **Copy the data** (users get new random passwords, written to `backend/.migration-passwords.local`):
   ```bash
   SUPABASE_URL='https://….supabase.co' SUPABASE_SERVICE_ROLE_KEY='…' DATABASE_URL='<owner url>' node scripts/migrate-from-supabase.mjs
   ```
   Share each password, then delete that file. (Starting fresh instead? `node scripts/create-super-admin.mjs tanmay "Tanmay Khambhadiya"`.)
5. **Create the backend app** in Coolify with the variables above → deploy → open `https://api.clipcrew.ignitralabs.com/health` (should answer `{"ok":true}`).
6. **Update the frontend app's variables** (above), then merge the `self-hosted-db` branch into `main` — Coolify redeploys the frontend.
7. **Check:** sign in, open Campaigns, Submissions and Clippers, send yourself a notice.
8. **Lock down:** switch Postgres to *not* publicly available, confirm backups run. Delete the Supabase project after a week.

## Rollback

The old site keeps working from the `main` branch until step 6. If something is wrong afterwards, redeploy the previous
commit of `main` in Coolify and restore the three Supabase variables.
