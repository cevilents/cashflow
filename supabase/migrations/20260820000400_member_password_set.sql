alter table public.members
  add column if not exists password_set boolean not null default false;
