# ClipCrew website

> One video in. A hundred reels out.

Single-page marketing site with a Join Waitlist modal and a small contact form.
Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · Supabase.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (secret key — server only)
   - `NEXT_PUBLIC_SITE_URL` (production URL, for OG tags)
3. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
4. `npm run dev` → http://localhost:3000

## Notes

- `/?waitlist=creator|promoter|clipper` opens the waitlist with that role pre-selected. `utm_source` and the param are saved to `source`.
- Spam protection: hidden honeypot field, 2-second minimum fill time on the waitlist, 5 requests / IP / 10 min (in-memory).
- Drop a `public/demo.mp4` to show the demo video in the Automation section (hidden when absent; checked at build time).

## Before launch

Replace placeholders: Privacy/Terms copy, `NEXT_PUBLIC_SITE_URL`, optional demo video.

## Deploy

Import the repo in Vercel and add the same env vars.
