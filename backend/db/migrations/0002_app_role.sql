-- Least-privilege database user for the API. The app connects as clipcrew_app, never as the superuser.
-- {{APP_DB_PASSWORD}} is filled in by db/migrate.mjs from the environment (never committed).
do $$ begin
  if not exists (select from pg_roles where rolname = 'clipcrew_app') then
    create role clipcrew_app login password '{{APP_DB_PASSWORD}}';
  else
    alter role clipcrew_app password '{{APP_DB_PASSWORD}}';
  end if;
end $$;

grant usage on schema public to clipcrew_app;
grant select, insert, update, delete on all tables in schema public to clipcrew_app;
alter default privileges in schema public grant select, insert, update, delete on tables to clipcrew_app;

-- PostgREST-era roles from the first setup: not used any more, remove their access in this database.
do $$ declare r text; begin
  foreach r in array array['anon', 'service_role', 'authenticator'] loop
    if exists (select from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke usage on schema public from %I', r);
    end if;
  end loop;
end $$;
