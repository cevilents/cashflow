-- Allow any authenticated member to manage funding-source accounts (shared).
drop policy if exists "accounts write all funding" on public.accounts;
create policy "accounts write all funding" on public.accounts for all
  using (type = 'funding')
  with check (type = 'funding');

-- History of dated balance adjustments (top-up / withdrawal) per funding source.
create table if not exists public.funding_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric(18,2) not null check (amount <> 0),
  date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.funding_transactions enable row level security;

create policy "funding_transactions select all" on public.funding_transactions for select
  using (auth.role() = 'authenticated');
create policy "funding_transactions write all" on public.funding_transactions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
