-- members: fixed 3 slots, public readable so members can resolve names/colors
create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  color text not null default '#10b981',
  icon text not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;
create policy "members select all" on public.members for select
  using (auth.role() = 'authenticated');

create table public.app_settings (
  id int primary key default 1,
  setup_complete boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "app_settings select all" on public.app_settings for select
  using (auth.role() = 'authenticated');

-- Relax RLS: SELECT sees all rows, writes only own
drop policy "accounts all own" on public.accounts;
create policy "accounts select all" on public.accounts for select
  using (auth.role() = 'authenticated');
create policy "accounts write own" on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy "categories all own" on public.categories;
create policy "categories select all" on public.categories for select
  using (auth.role() = 'authenticated');
create policy "categories write own" on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy "transactions all own" on public.transactions;
create policy "transactions select all" on public.transactions for select
  using (auth.role() = 'authenticated');
create policy "transactions write own" on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy "recurring all own" on public.recurring_transactions;
create policy "recurring select all" on public.recurring_transactions for select
  using (auth.role() = 'authenticated');
create policy "recurring write own" on public.recurring_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
