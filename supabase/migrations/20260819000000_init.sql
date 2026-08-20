-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  currency text not null default 'IDR',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash','bank','ewallet','other')),
  opening_balance numeric(18,2) not null default 0,
  color text not null default '#10b981',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text not null default 'tag',
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  type text not null check (type in ('income','expense','transfer')),
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(18,2) not null check (amount > 0),
  to_account_id uuid references public.accounts(id) on delete cascade,
  note text not null default '',
  date date not null default current_date,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_requires_account check (
    (type = 'transfer') = (to_account_id is not null)
  ),
  constraint transfer_has_no_category check (
    type <> 'transfer' or category_id is null
  )
);

-- recurring_transactions
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('income','expense')),
  amount numeric(18,2) not null check (amount > 0),
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_transactions enable row level security;

create policy "profiles select own" on public.profiles for select
  using (auth.uid() = id);
create policy "profiles update own" on public.profiles for update
  using (auth.uid() = id);

create policy "accounts all own" on public.accounts for all
  using (auth.uid() = user_id);

create policy "categories all own" on public.categories for all
  using (auth.uid() = user_id);

create policy "transactions all own" on public.transactions for all
  using (auth.uid() = user_id);

create policy "recurring all own" on public.recurring_transactions for all
  using (auth.uid() = user_id);

-- storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false);

create policy "receipts owner all" on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid()::text));
