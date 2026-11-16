-- Clippers submit the URL of each reel they post; staff review them.
create table submissions (
  id uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id uuid not null references social_accounts(id) on delete cascade,
  url text not null,
  url_key text not null unique,          -- normalised URL (host + path, no query/hash) — blocks duplicates
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  reject_reason text,
  fine_id uuid references fines(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on submissions (campaign_id, status, created_at desc);
create index on submissions (clipper_id, created_at desc);
create index on submissions (status, created_at);
grant select, insert, update, delete on submissions to clipcrew_app;

-- new staff permission: review clip submissions
alter table profiles drop constraint profiles_permissions_check;
alter table profiles add constraint profiles_permissions_check check (permissions <@ array[
  'users.create','accounts.verify','campaigns.manage','views.enter','rejections.send',
  'fines.create','payouts.manage','audit.view','export.data','submissions.review'
]);
