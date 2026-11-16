# ClipCrew

> One video in. A hundred reels out.

Marketing site + a management portal for clipping campaigns (admins, staff and clippers).

| Part | Stack | Folder |
|---|---|---|
| **Website + portal screens** | Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion | repo root |
| **API** | Fastify, TypeScript, PostgreSQL (`pg`) | [`backend/`](backend/README.md) |
| **Database** | your own PostgreSQL, schema in `backend/db/migrations` | — |

The website never touches the database: pages call the API (`/api/me`, `/api/pages/*`, …) and forward the visitor's
login cookie. The API checks who you are and what you may do on every request.

## What it does

- **Marketing site:** campaign-focused homepage, waitlist modal, contact form.
- **Admin (super admin and staff, with per-person permissions):** campaigns (₹ per 1M views, platforms, account limits),
  weekly views with automatic earnings, clip **submission review**, account verification (staff type the code), rejections
  with fines, **notices** to everyone/campaigns/chosen clippers with read counts, a one-screen **clipper profile**,
  payouts, CSV exports, activity log.
- **Clipper portal:** earnings dashboard, campaigns, account linking, **reel URL submissions**, wallet, inbox.

## Run locally

```bash
# 1) the API  (see backend/README.md for the database setup)
cd backend && npm install && cp .env.example .env.local && npm run dev      # http://localhost:4000

# 2) the website
cd .. && npm install
printf 'NEXT_PUBLIC_API_URL=http://localhost:4000\nAPI_URL=http://localhost:4000\n' > .env.local
npm run dev                                                                    # http://localhost:3000
```

For local development the API's `FRONTEND_ORIGIN` must be `http://localhost:3000` (the default).

## Notes

- `/?waitlist=creator|promoter|clipper` opens the waitlist with that role pre-selected.
- Spam protection on public forms: hidden honeypot, 2-second minimum fill time, 5 requests / IP / 10 min.
- Drop a `public/demo.mp4` to show the demo video in the Automation section (hidden when absent; checked at build time).
- Tests: `backend/scripts/e2e.mjs` (about 165 checks; API, permissions, and every page through the website). Test database only.

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md): two Coolify apps (website + API), environment variables, and the cut-over checklist.
