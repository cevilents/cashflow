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

-- A funding source with history cannot be hard-deleted; it must be archived instead.
create or replace function public.guard_funding_account_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.type = 'funding' then
    if exists (select 1 from public.transactions where account_id = old.id or to_account_id = old.id)
       or exists (select 1 from public.funding_transactions where account_id = old.id) then
      raise exception 'Sumber dana dengan aktivitas tidak bisa dihapus, arsipkan saja';
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_funding_account_delete on public.accounts;
create trigger trg_guard_funding_account_delete
  before delete on public.accounts
  for each row execute procedure public.guard_funding_account_delete();

-- Shared funding is owned by whoever creates it; force user_id to the caller on insert.
create or replace function public.force_funding_user_id()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.type = 'funding' then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_force_funding_user_id on public.accounts;
create trigger trg_force_funding_user_id
  before insert on public.accounts
  for each row execute procedure public.force_funding_user_id();
