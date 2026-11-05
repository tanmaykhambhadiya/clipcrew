-- ClipCrew database for self-hosted PostgreSQL (replaces Supabase). Safe to run once on an empty database.
-- The app talks to it through PostgREST using the `service_role` role (see db/README.md).
-- Money is stored in paise (integer) to avoid rounding errors.

-- ───────────── Marketing site ─────────────
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
  source text
);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  message text not null
);

-- ───────────── Portal ─────────────
create table profiles (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique check (login_id = lower(login_id) and login_id ~ '^[a-z0-9._-]{3,30}$'),
  full_name text not null,
  role text not null check (role in ('super_admin','admin','clipper')),
  status text not null default 'active' check (status in ('active','terminated')),
  permissions text[] not null default '{}' check (permissions <@ array[
    'users.create','accounts.verify','campaigns.manage','views.enter','rejections.send',
    'fines.create','payouts.manage','audit.view','export.data'
  ]),
  upi_id text,
  phone text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  terminated_at timestamptz,
  termination_reason text
);

-- Login: scrypt password hash per user (format scrypt$N$r$p$salt$hash, base64url parts).
create table credentials (
  user_id uuid primary key references profiles(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

-- Sessions: the cookie holds a random token; only its SHA-256 is stored.
create table sessions (
  token_hash text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on sessions (user_id);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text,
  rate_per_million_paise bigint not null check (rate_per_million_paise >= 0),
  allowed_platforms text[] not null default '{instagram,youtube,tiktok,facebook}',
  max_accounts_per_clipper int not null default 1 check (max_accounts_per_clipper >= 1),
  status text not null default 'active' check (status in ('draft','active','paused','ended')),
  starts_on date,
  ends_on date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table campaign_staff (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  staff_id uuid not null references profiles(id) on delete cascade,
  primary key (campaign_id, staff_id)
);

create table campaign_clippers (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  clipper_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, clipper_id)
);

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram','youtube','tiktok','facebook','x','other')),
  username text not null check (username = lower(username)),
  verify_code text not null default '',            -- typed by staff and sent to the clipper; '' = not sent yet
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, username)
);

create table campaign_accounts (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  primary key (campaign_id, account_id)
);

create table weekly_views (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  views bigint not null check (views >= 0),
  rate_per_million_paise bigint not null,
  amount_paise bigint not null,
  entered_by uuid not null references profiles(id),
  updated_at timestamptz not null default now(),
  unique (campaign_id, account_id, week_start)
);

create table fines (
  id uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  amount_paise bigint not null check (amount_paise > 0),
  reason text not null,
  reel_ref text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  waived_by uuid references profiles(id),
  waived_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('reel_rejected','fine','account_verified','account_rejected','payout','info')),
  title text not null,
  body text,
  reel_ref text,
  campaign_id uuid references campaigns(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references profiles(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  paid_on date not null,
  reference text,
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index on notifications (clipper_id, created_at desc);
create index on weekly_views (account_id, week_start);
create index on weekly_views (campaign_id, week_start);
create index on fines (clipper_id);
create index on payouts (clipper_id);
create index on social_accounts (clipper_id);
create index on audit_log (entity, entity_id);
create index on audit_log (created_at desc);

create view clipper_balances as
select
  p.id as clipper_id,
  coalesce((select sum(w.amount_paise) from weekly_views w
            join social_accounts a on a.id = w.account_id where a.clipper_id = p.id), 0) as earned_paise,
  coalesce((select sum(f.amount_paise) from fines f
            where f.clipper_id = p.id and f.waived_at is null), 0) as fines_paise,
  coalesce((select sum(y.amount_paise) from payouts y where y.clipper_id = p.id), 0) as paid_paise
from profiles p
where p.role = 'clipper';

-- ───────────── Access for PostgREST ─────────────
-- `anon` (no token) can do nothing. `service_role` (the app's signed token) can read/write everything.
-- `authenticator` is the login PostgREST uses; its password is set by db/setup.mjs, never committed.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
revoke all on all tables in schema public from anon;
