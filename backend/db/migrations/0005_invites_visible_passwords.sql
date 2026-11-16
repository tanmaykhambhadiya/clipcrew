-- 1) The password ClipCrew issued to a clipper (on creation / reset / invite sign-up), encrypted with the
--    server's SECRET_KEY, so the super admin can look it up again. Cleared when the clipper sets their own.
alter table credentials add column visible_password text;

-- 2) Invite links: the super admin shares one URL, clippers open it and get an account in one step.
create table invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  label text not null,
  campaign_ids uuid[] not null default '{}',   -- campaigns new clippers join automatically
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
alter table profiles add column invite_id uuid references invite_links(id) on delete set null;
grant select, insert, update, delete on invite_links to clipcrew_app;
