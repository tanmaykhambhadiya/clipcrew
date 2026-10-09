-- Run once in the Supabase SQL editor.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  role text not null check (role in ('creator','promoter','clipper')),
  name text not null,
  email text not null unique,
  whatsapp text,
  handle text,
  audience_size text,
  release_date date,
  clipping_experience text,
  source text            -- e.g. utm_source or ?waitlist= param
);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  message text not null
);

alter table waitlist enable row level security;
alter table contact_messages enable row level security;
-- No public policies: all inserts go through the server API routes using the service role key.
