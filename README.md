# ClipCrew website

> One video in. A hundred reels out.

Single-page marketing site with a Join Waitlist modal and a small contact form.
Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · self-hosted PostgreSQL + PostgREST.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in `POSTGREST_URL` and `POSTGREST_JWT_SECRET`.
3. Database setup (tables, roles, PostgREST): see [db/README.md](db/README.md).
4. `npm run dev` → http://localhost:3000

## Notes

- `/?waitlist=creator|promoter|clipper` opens the waitlist with that role pre-selected. `utm_source` and the param are saved to `source`.
- Spam protection: hidden honeypot field, 2-second minimum fill time on the waitlist, 5 requests / IP / 10 min (in-memory).
- Drop a `public/demo.mp4` to show the demo video in the Automation section (hidden when absent; checked at build time).

## Before launch

Replace placeholders: Privacy/Terms copy, optional demo video.

## Deploy

Deployed with Coolify (Nixpacks, port 3000). Set the same env vars as `.env.example`.
