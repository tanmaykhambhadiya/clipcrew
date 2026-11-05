-- ClipCrew clipper portal. Run once in the Supabase SQL editor (after schema.sql).
-- All access goes through server routes using the service role key, which checks the
-- caller's role in code. RLS is on with no public policies, same as waitlist.
-- Money is stored in paise (integer) to avoid rounding errors.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique check (login_id = lower(login_id) and login_id ~ '^[a-z0-9._-]{3,30}$'),
  full_name text not null,
  role text not null check (role in ('super_admin','admin','clipper')),
  status text not null default 'active' check (status in ('active','terminated')),
  -- Staff permissions, ticked per person by the super admin. Super admin implicitly has all of them;
  -- clippers have none. Checked in the server routes, always together with campaign assignment.
  permissions text[] not null default '{}' check (permissions <@ array[
    'users.create',        -- add clippers / reset their passwords
    'accounts.verify',     -- verify or reject clipper social accounts
    'campaigns.manage',    -- create/edit campaigns, assign clippers
    'views.enter',         -- enter weekly views
    'rejections.send',     -- send reel-rejected notices
    'fines.create',        -- add a fine with a rejection
    'payouts.manage',      -- record payouts
    'audit.view',          -- see the activity log
    'export.data'          -- CSV exports
  ]),
  -- Super admin only (never granted to staff): terminate users, change rates, waive fines,
  -- manage staff and their permissions.
  upi_id text,
  phone text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  terminated_at timestamptz,
  termination_reason text
);

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

-- staff who may manage a campaign (enter views, send rejections). Super admin sees all.
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
  verify_code text not null,                      -- issued to the clipper, checked in their bio by staff
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, username)
);

-- which verified accounts count towards which campaign
create table campaign_accounts (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  primary key (campaign_id, account_id)
);

-- weekly views entered by hand; amount is derived and stored with the rate used at the time
create table weekly_views (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),   -- Mondays
  views bigint not null check (views >= 0),
  rate_per_million_paise bigint not null,
  amount_paise bigint not null,                   -- floor(views * rate / 1,000,000)
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
  reel_ref text,                                  -- link or description of the rejected reel
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  waived_by uuid references profiles(id),         -- super admin only
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
  reference text,                                 -- UPI / transaction id
  note text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,                           -- e.g. VIEWS_SET, RATE_CHANGED, USER_TERMINATED
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

-- Balance per clipper = earned weekly amounts - active fines - payouts
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

alter table profiles enable row level security;
alter table campaigns enable row level security;
alter table campaign_staff enable row level security;
alter table campaign_clippers enable row level security;
alter table social_accounts enable row level security;
alter table campaign_accounts enable row level security;
alter table weekly_views enable row level security;
alter table fines enable row level security;
alter table notifications enable row level security;
alter table payouts enable row level security;
alter table audit_log enable row level security;
alter view clipper_balances set (security_invoker = true);
