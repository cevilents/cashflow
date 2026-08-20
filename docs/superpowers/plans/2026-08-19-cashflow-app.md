# Cashflow App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun aplikasi web React (Vite + TypeScript + Tailwind + Supabase) untuk mencatat pemasukan, pengeluaran, dan transfer antar akun, lengkap dengan bukti transaksi (upload gambar), dashboard, laporan, kategori, transaksi berulang, dan multi-akun — berbahasa Indonesia dan mata uang Rupiah.

**Architecture:** React SPA di Vite memakai TanStack Query untuk mengambil data dari Supabase (Postgres + Auth email/password + Storage bucket `receipts`). Semua tabel punya RLS per-user. Saldo akun dihitung dari riwayat transaksi, tidak disimpan manual.

**Tech Stack:** Vite 7, React 19, TypeScript strict, Tailwind CSS v4, TanStack Query v5, React Router 7, Recharts, lucide-react, @supabase/supabase-js, date-fns, Vitest + React Testing Library.

## Global Constraints

- Bahasa antarmuka: Bahasa Indonesia. Mata uang: Rupiah (`Rp 1.500.000`).
- Windows PowerShell 5.1 shell — jangan pakai `&&`; pakai `; if ($?) { ... }`.
- Tipe transaksi hanya 3: `income`, `expense`, `transfer`. Transfer tidak memakai kategori dan tanpa lampiran.
- Akun tidak bisa dihapus jika sudah punya transaksi (harus diarsipkan). Kategori yang dihapus → `category_id` transaksi di-set NULL.
- Semua angka disimpan `numeric(18,2)`, selalu positif untuk `amount`.
- TypeScript strict; tiap file wajib lolos `tsc --noEmit`.
- Tidak ada komentar kode tanpa diminta.
- TDD wajib untuk logika murni (format, saldo, tanggal). UI diuji minimal lewat build + tsc + manual.

---

### Task 1: Scaffold project Vite + React + TS + Tailwind v4 + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/lib/sanity.test.ts`

**Interfaces:**
- Produces: struktur project jalan (`npm run dev`, `npm run build`, `npm test`, `npm run lint`).

- [ ] **Step 1: Inisialisasi git & scaffold**

```powershell
git init
npm create vite@latest . -- --template react-ts
npm install
npm install @tanstack/react-query react-router-dom @supabase/supabase-js recharts lucide-react date-fns
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom
```

Catatan: template react-ts sudah menyertakan `@vitejs/plugin-react`, TypeScript, dan ESLint.

- [ ] **Step 2: Konfigurasi Vite + Tailwind v4 + Vitest**

Ganti isi `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

Hapus `src/App.css` dan isi `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-surface: #0b1220;
  --color-surface-soft: #111a2e;
  --color-surface-card: #16203a;
  --color-border-subtle: #233052;
  --color-ink: #e6ecf7;
  --color-ink-muted: #8ea0c3;
  --color-good: #10b981;
  --color-bad: #f43f5e;
  --color-move: #38bdf8;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

* { min-width: 0; }

body {
  @apply bg-surface text-ink antialiased;
}

.tabular { font-variant-numeric: tabular-nums; }
```

Tulis `src/App.tsx` minimal:

```tsx
export default function App() {
  return <div className="p-8">Cashflow</div>
}
```

Hapus `src/assets/react.svg` dan `src/App.css`.

- [ ] **Step 3: Setup test environment**

Buat `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Buat `src/lib/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Perbaiki TypeScript strict + ESLint**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json` (ganti yang di-generate):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

Hapus isi `eslint.config.js` bawaan dan tulis:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
```

Pasang dependensi lint: `npm i -D @eslint/js globals eslint-plugin-react-hooks eslint-plugin-react-refresh typescript-eslint`.

- [ ] **Step 5: `.gitignore` & `.env.example`**

`.gitignore` tambahkan:

```
.env
*.local
```

Buat `.env.example`:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 6: Verifikasi**

```powershell
npm run build
npm run lint
npm test
```

Expected: build sukses tanpa error TS, lint bersih, 1 test pass.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "chore: scaffold vite react-ts project with tailwind, vitest, eslint"
```

---

### Task 2: Migrasi Supabase (tabel + trigger + RLS + storage)

**Files:**
- Create: `supabase/migrations/20260819000000_init.sql`

**Interfaces:**
- Produces: skema database siap dipakai — tabel `profiles`, `accounts`, `categories`, `transactions`, `recurring_transactions`, bucket storage `receipts`, semua dengan RLS.

- [ ] **Step 1: Tulis migration**

`supabase/migrations/20260819000000_init.sql`:

```sql
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
```

- [ ] **Step 2: Inisialisasi Supabase di project**

```powershell
supabase init
```

- [ ] **Step 3: Hubungkan & terapkan (butuh input user)**

Pengguna harus punya project Supabase. MCP belum terautentikasi di lingkungan ini, jadi pakai CLI:

```powershell
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Expected: migration diterapkan tanpa error. Kemudian ambil `Project URL` dan `anon public key` dari dashboard Supabase (Settings → API) dan isi ke `.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

> Jika belum punya project: buat di https://supabase.com. Untuk memudahkan tes, matikan "Confirm email" di Authentication → Sign In / Providers (atau konfirmasi via email yang dikirim).

- [ ] **Step 4: Verify**

```powershell
supabase db push --dry-run
```

Expected: 0 perubahan tersisa.

- [ ] **Step 5: Commit**

```powershell
git add supabase .env.example
git commit -m "feat: add supabase schema, rls, and storage bucket migrations"
```

---

### Task 3: Core libs — supabase client, types, format, tanggal, saldo (+ tests)

**Files:**
- Create: `src/lib/supabase.ts`, `src/types/database.ts`, `src/lib/format.ts`, `src/lib/dates.ts`, `src/lib/balances.ts`
- Test: `src/lib/format.test.ts`, `src/lib/balances.test.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `supabase` (client Singleton).
  - `Account`, `Category`, `Transaction`, `RecurringTransaction`, dan union types.
  - `formatRupiah(value: number): string`, `parseAmountInput(raw: string): number | null`.
  - `todayISO(): string`, `advanceDate(dateISO, frequency): string`, `formatDay(dateISO): string`.
  - `computeAccountBalances(accounts: Account[], transactions: Transaction[]): Record<string, number>`, `totalBalance(balances: Record<string, number>): number`.

- [ ] **Step 1: Tulis failing tests**

`src/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatRupiah, parseAmountInput } from './format'

describe('formatRupiah', () => {
  it('formats positive values', () => {
    expect(formatRupiah(1500000)).toBe('Rp 1.500.000')
  })
  it('formats negative values', () => {
    expect(formatRupiah(-95000)).toBe('-Rp 95.000')
  })
  it('rounds decimals', () => {
    expect(formatRupiah(1000.7)).toBe('Rp 1.001')
  })
})

describe('parseAmountInput', () => {
  it('parses digits only', () => {
    expect(parseAmountInput('12.500')).toBe(12500)
  })
  it('returns null for empty or zero', () => {
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('0')).toBeNull()
  })
})
```

`src/lib/balances.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeAccountBalances, totalBalance } from './balances'
import type { Account, Transaction } from '../types/database'

const acc = (id: string, opening = 0): Account => ({
  id, user_id: 'u', name: id, type: 'cash', opening_balance: opening,
  color: '#000', is_archived: false, created_at: '',
})
const tx = (partial: Partial<Transaction>): Transaction => ({
  id: partial.id ?? 't', user_id: 'u', account_id: partial.account_id ?? 'a',
  type: partial.type!, category_id: null, amount: partial.amount ?? 0,
  to_account_id: partial.to_account_id ?? null, note: '', date: '2026-08-01',
  receipt_url: null, created_at: '', updated_at: '',
})

describe('computeAccountBalances', () => {
  it('starts from opening balance', () => {
    const r = computeAccountBalances([acc('a', 1000)], [])
    expect(r['a']).toBe(1000)
  })
  it('adds income, subtracts expense', () => {
    const accounts = [acc('a', 1000)]
    const transactions = [
      tx({ id: '1', account_id: 'a', type: 'income', amount: 500 }),
      tx({ id: '2', account_id: 'a', type: 'expense', amount: 200 }),
    ]
    expect(computeAccountBalances(accounts, transactions)['a']).toBe(1300)
  })
  it('transfer debits source and credits destination', () => {
    const accounts = [acc('a', 1000), acc('b', 0)]
    const transactions = [
      tx({ id: '1', account_id: 'a', type: 'transfer', amount: 300, to_account_id: 'b' }),
    ]
    const r = computeAccountBalances(accounts, transactions)
    expect(r['a']).toBe(700)
    expect(r['b']).toBe(300)
  })
  it('does not double count transfer source', () => {
    const accounts = [acc('a', 1000)]
    const transactions = [tx({ id: '1', account_id: 'a', type: 'transfer', amount: 300, to_account_id: 'x' })]
    expect(computeAccountBalances(accounts, transactions)['a']).toBe(700)
  })
})

describe('totalBalance', () => {
  it('sums all balances', () => {
    expect(totalBalance({ a: 100, b: -30 })).toBe(70)
  })
})
```

`src/lib/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { advanceDate } from './dates'

describe('advanceDate', () => {
  it('advances a week', () => {
    expect(advanceDate('2026-08-19', 'weekly')).toBe('2026-08-26')
  })
  it('advances a month', () => {
    expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-03-03')
  })
  it('advances a year', () => {
    expect(advanceDate('2026-08-19', 'yearly')).toBe('2027-08-19')
  })
})
```

> `advanceDate('2026-01-31','monthly')` = `'2026-03-03'` karena date-fns `addMonths` melakukan clamp (31 Jan → 28/29 Feb → 3 Mar). Tes ini mengunci perilaku itu.

- [ ] **Step 2: Jalankan test — expected FAIL**

```powershell
npm test
```

Expected: gagal karena file `.ts` belum ada (module not found).

- [ ] **Step 3: Implementasi**

`src/types/database.ts`:

```ts
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense'
export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface Profile {
  id: string
  full_name: string
  currency: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  opening_balance: number
  color: string
  is_archived: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  icon: string
  color: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  type: TransactionType
  category_id: string | null
  amount: number
  to_account_id: string | null
  note: string
  date: string
  receipt_url: string | null
  created_at: string
  updated_at: string
}

export interface RecurringTransaction {
  id: string
  user_id: string
  name: string
  account_id: string
  category_id: string | null
  type: Exclude<TransactionType, 'transfer'>
  amount: number
  frequency: Frequency
  next_due_date: string
  is_active: boolean
  created_at: string
}
```

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY wajib diisi di .env')
}

export const supabase = createClient(url, anonKey)
```

`src/lib/format.ts`:

```ts
export function formatRupiah(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(Math.round(value))
  return `${sign}Rp ${new Intl.NumberFormat('id-ID').format(abs)}`
}

export function parseAmountInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = parseInt(digits, 10)
  return Number.isFinite(value) && value > 0 ? value : null
}
```

`src/lib/dates.ts`:

```ts
import { addWeeks, addMonths, addYears, format, parseISO } from 'date-fns'
import type { Frequency } from '../types/database'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function advanceDate(dateISO: string, frequency: Frequency): string {
  const base = parseISO(dateISO)
  const next =
    frequency === 'weekly'
      ? addWeeks(base, 1)
      : frequency === 'monthly'
        ? addMonths(base, 1)
        : addYears(base, 1)
  return format(next, 'yyyy-MM-dd')
}

export function formatDay(dateISO: string): string {
  return format(parseISO(dateISO), 'dd MMM yyyy')
}
```

`src/lib/balances.ts`:

```ts
import type { Account, Transaction } from '../types/database'

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const acc of accounts) balances[acc.id] = Number(acc.opening_balance) || 0
  for (const t of transactions) {
    const amount = Number(t.amount) || 0
    if (t.type === 'income') {
      balances[t.account_id] = (balances[t.account_id] ?? 0) + amount
    } else if (t.type === 'expense') {
      balances[t.account_id] = (balances[t.account_id] ?? 0) - amount
    } else {
      balances[t.account_id] = (balances[t.account_id] ?? 0) - amount
      if (t.to_account_id) balances[t.to_account_id] = (balances[t.to_account_id] ?? 0) + amount
    }
  }
  return balances
}

export function totalBalance(balances: Record<string, number>): number {
  return Object.values(balances).reduce((sum, v) => sum + v, 0)
}
```

- [ ] **Step 4: Jalankan test — expected PASS**

```powershell
npm test
npm run build
npm run lint
```

- [ ] **Step 5: Commit**

```powershell
git add src/lib src/types src/test
git commit -m "feat: add core libs for formatting, dates, and balances"
```

---

### Task 4: UI primitives + Toast

**Files:**
- Create: `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`, `EmptyState.tsx`, `Spinner.tsx`, `Badge.tsx`, `Lightbox.tsx`, `Toast.tsx`

**Interfaces:**
- Produces (dipakai semua halaman selanjutnya):
  - `Button({ variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md', ...props })`
  - `Input`, `Textarea`, `Select` dibungkus `FieldProps { label?, error? }`.
  - `Modal({ open, onClose, title, children, footer?, wide? })`.
  - `ConfirmDialog({ open, title, message, confirmLabel?, onConfirm, onCancel })`.
  - `EmptyState({ icon?, title, message?, action? })`.
  - `Spinner({ size? })`, `Badge({ tone, children })`.
  - `Lightbox({ src, alt, onClose })`.
  - `ToastProvider` + `useToast()` → `{ toast(message, type?) }`.

- [ ] **Step 1: `Toast.tsx`**

```tsx
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ToastContextValue {
  toast: (message: string, type?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++counter.current
    setItems((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-4 py-3 text-sm shadow-lg"
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-good" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 text-bad" />
            )}
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
```

- [ ] **Step 2: `Button.tsx`, `Input.tsx`, `Select.tsx`**

```tsx
// Button.tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-good text-white hover:bg-emerald-500',
  secondary: 'bg-surface-soft text-ink border border-border-subtle hover:bg-surface-card',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-soft',
  danger: 'bg-bad text-white hover:bg-rose-500',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm'
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes} ${className}`}
      {...props}
    />
  )
}
```

```tsx
// Input.tsx
import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'w-full rounded-xl border border-border-subtle bg-surface-soft px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 outline-none transition focus:border-good focus:ring-2 focus:ring-good/20'

export interface FieldProps {
  label?: string
  error?: string
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, error, className = '', id, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>}
      <input id={id} ref={ref} className={`${base} ${error ? 'border-bad' : ''} ${className}`} {...props} />
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea({ label, error, className = '', id, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>}
      <textarea id={id} ref={ref} rows={3} className={`${base} ${error ? 'border-bad' : ''} ${className}`} {...props} />
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
})
```

```tsx
// Select.tsx
import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import type { FieldProps } from './Input'

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select({ label, error, className = '', id, children, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>}
      <select
        id={id}
        ref={ref}
        className={`w-full rounded-xl border border-border-subtle bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-good focus:ring-2 focus:ring-good/20 ${error ? 'border-bad' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
})
```

- [ ] **Step 3: `Spinner.tsx`, `Badge.tsx`, `EmptyState.tsx`, `ConfirmDialog.tsx`, `Modal.tsx`, `Lightbox.tsx`**

```tsx
// Spinner.tsx
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Memuat"
    />
  )
}
```

```tsx
// Badge.tsx
import type { ReactNode } from 'react'

export type BadgeTone = 'good' | 'bad' | 'move' | 'neutral'

const tones: Record<BadgeTone, string> = {
  good: 'bg-good/15 text-good',
  bad: 'bg-bad/15 text-bad',
  move: 'bg-move/15 text-move',
  neutral: 'bg-surface-soft text-ink-muted border border-border-subtle',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}
```

```tsx
// EmptyState.tsx
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-subtle bg-surface-soft/40 px-6 py-12 text-center">
      <div className="text-ink-muted">{icon ?? <Inbox className="h-10 w-10" />}</div>
      <p className="font-medium text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
```

```tsx
// Modal.tsx
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-2xl ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-surface-soft hover:text-ink" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
```

```tsx
// ConfirmDialog.tsx
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-ink-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Batal</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
```

```tsx
// Lightbox.tsx
import { X } from 'lucide-react'

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" onClick={onClose}>
      <button className="absolute top-4 right-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20" onClick={onClose} aria-label="Tutup">
        <X className="h-6 w-6" />
      </button>
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-xl object-contain" />
    </div>
  )
}
```

- [ ] **Step 4: Verifikasi**

```powershell
npm run build
npm run lint
```

Expected: tidak ada error TS/lint.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui
git commit -m "feat: add ui primitives and toast provider"
```

---

### Task 5: Auth — context, login, register, protected route

**Files:**
- Create: `src/hooks/useAuth.tsx`, `src/components/auth/ProtectedRoute.tsx`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`, `src/main.tsx`, `src/App.tsx`, dan stub halaman lain.

**Interfaces:**
- Produces:
  - `useAuth()` → `{ user: User | null, loading: boolean, signOut(): Promise<void> }`
  - `ProtectedRoute` — redirect ke `/login` bila belum login.
  - `LoginPage`, `RegisterPage`.

- [ ] **Step 1: `src/hooks/useAuth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
```

- [ ] **Step 2: `src/components/auth/ProtectedRoute.tsx`**

```tsx
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui/Spinner'

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size={32} />
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 3: `src/pages/LoginPage.tsx`**

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-good">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Cashflow</h1>
            <p className="text-xs text-ink-muted">Kelola keuanganmu</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl border border-border-subtle bg-surface-card p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Masuk</h2>
          <div className="space-y-3">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Button type="submit" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'Masuk…' : 'Masuk'}
          </Button>
          <p className="mt-4 text-center text-sm text-ink-muted">
            Belum punya akun?{' '}
            <Link to="/register" className="text-good hover:underline">Daftar</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `src/pages/RegisterPage.tsx`**

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast('Password minimal 6 karakter', 'error')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    setSubmitting(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    toast('Akun dibuat! Silakan masuk.')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="rounded-2xl border border-border-subtle bg-surface-card p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Buat Akun</h2>
          <div className="space-y-3">
            <Input label="Nama" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <Button type="submit" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'Membuat…' : 'Daftar'}
          </Button>
          <p className="mt-4 text-center text-sm text-ink-muted">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-good hover:underline">Masuk</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
```

> Jika "Confirm email" aktif di project Supabase, user menerima email konfirmasi sebelum bisa login.

- [ ] **Step 5: Router — `src/App.tsx` + `src/main.tsx`**

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { ToastProvider } from './components/ui/Toast'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AppLayout from './components/layout/AppLayout'
import DashboardPage from './pages/DashboardPage'
import TransactionsPage from './pages/TransactionsPage'
import AccountsPage from './pages/AccountsPage'
import CategoriesPage from './pages/CategoriesPage'
import RecurringPage from './pages/RecurringPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/recurring" element={<RecurringPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

> Halaman yang diimpor belum ada. Buat file stub minimal supaya TS lolos: `src/components/layout/AppLayout.tsx` (return `<Outlet />`) dan tiap `src/pages/*.tsx` (return `<p>WIP</p>`). Diisi penuh di task berikutnya.

- [ ] **Step 6: Verifikasi & commit**

```powershell
npm run build
git add src/hooks src/components/auth src/pages src/main.tsx src/App.tsx
git commit -m "feat: add auth flow with login, register, and protected routes"
```

---

### Task 6: Data hooks (TanStack Query)

**Files:**
- Create: `src/hooks/useAccounts.ts`, `src/hooks/useCategories.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useRecurring.ts`

**Interfaces:**
- Consumes: `supabase`, types dari Task 3.
- Produces:
  - `useAccounts()`; `useCreateAccount`, `useUpdateAccount`, `useDeleteAccount`.
  - `useCategories()`; `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`.
  - `useTransactions()` (fetch semua, sort date desc); `useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction`, `TransactionInput`.
  - `useRecurring()`; `useCreateRecurring`, `useUpdateRecurring`, `useDeleteRecurring`.
  - Semua mutation invalidate query key terkait.

- [ ] **Step 1: `src/hooks/useAccounts.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Account } from '../types/database'

const selectAccounts = async (): Promise<Account[]> => {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as Account[]
}

export function useAccounts() {
  return useQuery({ queryKey: ['accounts'], queryFn: selectAccounts })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<Account, 'name' | 'type' | 'opening_balance' | 'color'>) => {
      const { error } = await supabase.from('accounts').insert({ ...input })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Account, 'id'> & Partial<Account>) => {
      const { error } = await supabase.from('accounts').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
```

- [ ] **Step 2: `src/hooks/useCategories.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Category } from '../types/database'

const selectCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as Category[]
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: selectCategories })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Pick<Category, 'name' | 'type' | 'icon' | 'color'>) => {
      const { error } = await supabase.from('categories').insert({ ...input })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Category, 'id'> & Partial<Category>) => {
      const { error } = await supabase.from('categories').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
```

- [ ] **Step 3: `src/hooks/useTransactions.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Transaction, TransactionType } from '../types/database'

const selectTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false })
  if (error) throw error
  return data as Transaction[]
}

export function useTransactions() {
  return useQuery({ queryKey: ['transactions'], queryFn: selectTransactions })
}

export interface TransactionInput {
  account_id: string
  type: TransactionType
  category_id: string | null
  amount: number
  to_account_id: string | null
  note: string
  date: string
  receipt_url: string | null
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { error } = await supabase.from('transactions').insert({ ...input })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Transaction, 'id'> & Partial<Transaction>) => {
      const { error } = await supabase.from('transactions').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}
```

- [ ] **Step 4: `src/hooks/useRecurring.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RecurringTransaction } from '../types/database'

const selectRecurring = async (): Promise<RecurringTransaction[]> => {
  const { data, error } = await supabase
    .from('recurring_transactions')
    .select('*')
    .order('next_due_date', { ascending: true })
  if (error) throw error
  return data as RecurringTransaction[]
}

export function useRecurring() {
  return useQuery({ queryKey: ['recurring'], queryFn: selectRecurring })
}

export function useCreateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at'>) => {
      const { error } = await supabase.from('recurring_transactions').insert({ ...input })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<RecurringTransaction, 'id'> & Partial<RecurringTransaction>) => {
      const { error } = await supabase.from('recurring_transactions').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useDeleteRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}
```

- [ ] **Step 5: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/hooks
git commit -m "feat: add tanstack query data hooks for all entities"
```

---

### Task 7: Layout — sidebar, mobile nav, topbar

**Files:**
- Create: `src/components/layout/AppLayout.tsx`, `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `useAuth` (`user`, `signOut`).
- Produces: `AppLayout` dengan `<Outlet />`, `Sidebar` (desktop), `MobileNav` (5 item), `QuickAddButton` (mobile FAB → `/transactions?new=1`).

- [ ] **Step 1: `src/components/layout/Sidebar.tsx`**

```tsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tags, CalendarClock, FileBarChart, Settings,
  LogOut, Plus,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Akun', icon: Wallet },
  { to: '/categories', label: 'Kategori', icon: Tags },
  { to: '/recurring', label: 'Berulang', icon: CalendarClock },
  { to: '/reports', label: 'Laporan', icon: FileBarChart },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

const mobileNav = nav.slice(0, 5)

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-card md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-good">
          <ArrowLeftRight className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-ink">Cashflow</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-good/15 text-good' : 'text-ink-muted hover:bg-surface-soft hover:text-ink'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border-subtle px-3 py-4">
        <div className="flex items-center gap-2 rounded-xl px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-soft text-xs font-bold text-ink">
            {initials}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{user?.email}</span>
        </div>
        <button
          onClick={async () => { await signOut(); navigate('/login') }}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
        >
          <LogOut className="h-5 w-5" />
          Keluar
        </button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-card px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-good' : 'text-ink-muted'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function QuickAddButton() {
  return (
    <NavLink
      to="/transactions?new=1"
      className="fixed right-4 bottom-20 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-good text-white shadow-xl md:hidden"
      aria-label="Tambah transaksi"
    >
      <Plus className="h-6 w-6" />
    </NavLink>
  )
}
```

- [ ] **Step 2: `src/components/layout/AppLayout.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { Sidebar, MobileNav, QuickAddButton } from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-24 md:pb-8">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      <QuickAddButton />
    </div>
  )
}
```

- [ ] **Step 3: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/components/layout
git commit -m "feat: add app layout with sidebar and mobile nav"
```

---

### Task 8: Komponen transaksi — form, upload bukti, list/row, filter

**Files:**
- Create: `src/components/receipt/receiptStorage.ts`, `src/components/receipt/ReceiptUpload.tsx`, `src/components/receipt/ReceiptLightbox.tsx`, `src/components/transaction/TransactionForm.tsx`, `src/components/transaction/TransactionList.tsx`, `src/components/transaction/TransactionRow.tsx`, `src/components/transaction/TransactionFilters.tsx`

**Interfaces:**
- Consumes: hooks Task 6, `useToast`, `useAuth`, UI primitives, `formatRupiah`, `parseAmountInput`, `todayISO`.
- Produces:
  - `uploadReceipt(file, userId, transactionId): Promise<string>`, `removeReceipt(path)`, `receiptUrl(path): Promise<string | null>`.
  - `ReceiptUpload({ current, onChange })` — `onChange(path: string | null, file?: File)`.
  - `ReceiptLightbox({ path, onClose })`.
  - `TransactionForm({ open, onClose, editing? })`.
  - `TransactionList`, `TransactionRow`, `TransactionFilters` + `emptyFilters`.

- [ ] **Step 1: `src/components/receipt/receiptStorage.ts`**

```ts
import { supabase } from '../../lib/supabase'

export async function uploadReceipt(file: File, userId: string, transactionId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${transactionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from('receipts').remove([path])
  if (error) throw error
}

export async function receiptUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
```

- [ ] **Step 2: `src/components/receipt/ReceiptUpload.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { receiptUrl } from './receiptStorage'

export function ReceiptUpload({
  current,
  onChange,
}: {
  current: string | null
  onChange: (path: string | null, file?: File) => void
}) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (current) {
      if (current.startsWith('blob:')) {
        setPreview(current)
      } else {
        receiptUrl(current).then((url) => { if (active && url) setPreview(url) })
      }
    } else {
      setPreview(null)
    }
    return () => { active = false }
  }, [current])

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">Bukti transaksi (opsional)</span>
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border-subtle">
          <img src={preview} alt="Pratinjau bukti" className="h-32 w-full object-cover" />
          <button
            type="button"
            onClick={() => { onChange(null); setPreview(null) }}
            className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white hover:bg-black/80"
            aria-label="Hapus bukti"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-soft/50 px-4 py-6 text-sm text-ink-muted hover:border-good hover:text-good">
          <Upload className="h-5 w-5" />
          Klik untuk pilih foto struk
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                if (file.size > 5 * 1024 * 1024) {
                  alert('Ukuran file maksimal 5 MB')
                  return
                }
                onChange('blob:' + file.name, file)
              }
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
```

> `ReceiptUpload` menerima `current: string | null` dan `onChange(path, file?)`. Saat pilih file baru, dipanggil `onChange('blob:' + file.name, file)`; saat hapus, `onChange(null)`.

- [ ] **Step 3: `src/components/receipt/ReceiptLightbox.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { receiptUrl } from './receiptStorage'
import { Lightbox } from '../ui/Lightbox'
import { Spinner } from '../ui/Spinner'

export function ReceiptLightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    receiptUrl(path).then((url) => setSrc(url ?? null))
  }, [path])
  if (!src) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={onClose}>
        <Spinner size={28} />
      </div>
    )
  }
  return <Lightbox src={src} alt="Bukti transaksi" onClose={onClose} />
}
```

- [ ] **Step 4: `src/components/transaction/TransactionForm.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input, Textarea } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions'
import { parseAmountInput, formatRupiah } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import { uploadReceipt, removeReceipt } from '../receipt/receiptStorage'
import { ReceiptUpload } from '../receipt/ReceiptUpload'
import type { Transaction, TransactionType } from '../../types/database'

export function TransactionForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Transaction | null
}) {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createTx = useCreateTransaction()
  const updateTx = useUpdateTransaction()
  const { toast } = useToast()

  const [type, setType] = useState<TransactionType>('expense')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activeAccounts = useMemo(() => (accounts ?? []).filter((a) => !a.is_archived), [accounts])
  const typeCategories = useMemo(
    () => (type === 'transfer' ? [] : (categories ?? []).filter((c) => c.type === (type === 'income' ? 'income' : 'expense'))),
    [categories, type],
  )

  useEffect(() => {
    if (!open) return
    if (editing) {
      setType(editing.type)
      setAccountId(editing.account_id)
      setCategoryId(editing.category_id ?? '')
      setToAccountId(editing.to_account_id ?? '')
      setAmountRaw(String(editing.amount))
      setDate(editing.date)
      setNote(editing.note)
      setReceiptPath(editing.receipt_url)
      setReceiptFile(null)
    } else {
      setType('expense')
      setAccountId(activeAccounts[0]?.id ?? '')
      setCategoryId('')
      setToAccountId('')
      setAmountRaw('')
      setDate(todayISO())
      setNote('')
      setReceiptPath(null)
      setReceiptFile(null)
    }
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const amount = parseAmountInput(amountRaw)
    const problems: Record<string, string> = {}
    if (amount === null) problems.amount = 'Masukkan jumlah yang valid'
    if (!accountId) problems.accountId = 'Pilih akun'
    if (type !== 'transfer' && !categoryId) problems.categoryId = 'Pilih kategori'
    if (type === 'transfer' && !toAccountId) problems.toAccountId = 'Pilih akun tujuan'
    if (type === 'transfer' && toAccountId === accountId) problems.toAccountId = 'Akun tujuan tidak boleh sama'
    if (!date) problems.date = 'Pilih tanggal'
    setErrors(problems)
    if (Object.keys(problems).length > 0 || amount === null) return

    setSaving(true)
    try {
      const base: TransactionInput = {
        account_id: accountId,
        type,
        category_id: type === 'transfer' ? null : categoryId || null,
        amount,
        to_account_id: type === 'transfer' ? toAccountId : null,
        note,
        date,
        receipt_url: type === 'transfer' ? null : receiptPath ?? null,
      }

      if (editing) {
        const oldReceipt = editing.receipt_url
        await updateTx.mutateAsync({ id: editing.id, ...base })
        if (receiptFile && oldReceipt) await removeReceipt(oldReceipt)
        if (receiptFile) {
          const finalPath = await uploadReceipt(receiptFile, user.id, editing.id)
          await supabase.from('transactions').update({ receipt_url: finalPath }).eq('id', editing.id)
        } else if (receiptPath === null && oldReceipt) {
          await removeReceipt(oldReceipt)
        }
        toast('Transaksi diperbarui')
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert({ ...base, receipt_url: receiptFile ? null : base.receipt_url })
          .select('id')
          .single()
        if (error) throw error
        if (receiptFile) {
          const finalPath = await uploadReceipt(receiptFile, user.id, data.id)
          await supabase.from('transactions').update({ receipt_url: finalPath }).eq('id', data.id)
        }
        toast('Transaksi ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan transaksi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Transaksi' : 'Tambah Transaksi'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" form="tx-form" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                type === t
                  ? t === 'expense' ? 'border-bad bg-bad/15 text-bad'
                    : t === 'income' ? 'border-good bg-good/15 text-good'
                    : 'border-move bg-move/15 text-move'
                  : 'border-border-subtle text-ink-muted hover:text-ink'
              }`}
            >
              {t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Input
            label="Jumlah (Rp)"
            inputMode="numeric"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value)}
            error={errors.amount}
            placeholder="0"
          />
          {parseAmountInput(amountRaw) !== null && (
            <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">
              = {formatRupiah(parseAmountInput(amountRaw)!)}
            </span>
          )}
        </div>

        <Select label="Akun" value={accountId} onChange={(e) => setAccountId(e.target.value)} error={errors.accountId}>
          <option value="">Pilih akun…</option>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>

        {type === 'transfer' ? (
          <Select label="Transfer ke" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} error={errors.toAccountId}>
            <option value="">Pilih akun tujuan…</option>
            {activeAccounts.filter((a) => a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        ) : (
          <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={errors.categoryId}>
            <option value="">Pilih kategori…</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}

        <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />

        <Textarea label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: belanja bulanan" />

        {type !== 'transfer' && (
          <ReceiptUpload
            current={receiptPath}
            onChange={(path, file) => {
              setReceiptPath(path)
              setReceiptFile(file ?? null)
            }}
          />
        )}
      </form>
    </Modal>
  )
}
```

> Impor `TransactionInput` dari `../../hooks/useTransactions`.

- [ ] **Step 5: `src/components/transaction/TransactionList.tsx`, `TransactionRow.tsx`, `TransactionFilters.tsx`**

`TransactionList.tsx`:

```tsx
import { SearchX } from 'lucide-react'
import { TransactionRow } from './TransactionRow'
import { EmptyState } from '../ui/EmptyState'
import type { Account, Category, Transaction } from '../../types/database'

export function TransactionList({
  transactions,
  accountsById,
  categoriesById,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[]
  accountsById: Record<string, Account>
  categoriesById: Record<string, Category>
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}) {
  if (transactions.length === 0) {
    return <EmptyState icon={<SearchX className="h-10 w-10" />} title="Tidak ada transaksi" message="Coba ubah filter atau tambah transaksi baru." />
  }
  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          account={accountsById[tx.account_id]}
          category={tx.category_id ? categoriesById[tx.category_id] : null}
          toAccount={tx.to_account_id ? accountsById[tx.to_account_id] : undefined}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
```

`TransactionRow.tsx`:

```tsx
import { useState } from 'react'
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { formatRupiah } from '../../lib/format'
import { formatDay } from '../../lib/dates'
import type { Account, Category, Transaction } from '../../types/database'
import { Button } from '../ui/Button'
import { ReceiptLightbox } from '../receipt/ReceiptLightbox'

const typeMeta = {
  income: { icon: ArrowUpRight, label: 'Pemasukan', cls: 'text-good' },
  expense: { icon: ArrowDownRight, label: 'Pengeluaran', cls: 'text-bad' },
  transfer: { icon: ArrowLeftRight, label: 'Transfer', cls: 'text-move' },
}

export function TransactionRow({
  tx,
  account,
  category,
  toAccount,
  onEdit,
  onDelete,
}: {
  tx: Transaction
  account?: Account
  category?: Category | null
  toAccount?: Account
  onEdit: (tx: Transaction) => void
  onDelete: (tx: Transaction) => void
}) {
  const [showReceipt, setShowReceipt] = useState(false)
  const meta = typeMeta[tx.type]
  const Icon = meta.icon

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-soft">
        <Icon className={`h-5 w-5 ${meta.cls}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">
          {tx.type === 'transfer'
            ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
            : category?.name ?? (tx.note || meta.label)}
        </p>
        <p className="flex items-center gap-2 truncate text-xs text-ink-muted">
          <span>{account?.name}</span>
          <span>·</span>
          <span>{formatDay(tx.date)}</span>
          {tx.receipt_url && (
            <button onClick={() => setShowReceipt(true)} className="flex items-center gap-1 text-move hover:underline" aria-label="Lihat bukti">
              <Paperclip className="h-3.5 w-3.5" /> bukti
            </button>
          )}
        </p>
      </div>
      <div className={`tabular text-sm font-semibold ${meta.cls}`}>
        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '⇄ '}{formatRupiah(tx.amount)}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => onEdit(tx)} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(tx)} aria-label="Hapus" className="text-bad">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {showReceipt && tx.receipt_url && <ReceiptLightbox path={tx.receipt_url} onClose={() => setShowReceipt(false)} />}
    </div>
  )
}
```

`TransactionFilters.tsx`:

```tsx
import { Search } from 'lucide-react'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import type { Account, Category } from '../../types/database'

export interface TxFiltersValue {
  search: string
  type: string
  accountId: string
  categoryId: string
  from: string
  to: string
}

export const emptyFilters: TxFiltersValue = { search: '', type: '', accountId: '', categoryId: '', from: '', to: '' }

export function TransactionFilters({
  value,
  onChange,
  accounts,
  categories,
}: {
  value: TxFiltersValue
  onChange: (v: TxFiltersValue) => void
  accounts: Account[]
  categories: Category[]
}) {
  const set = (patch: Partial<TxFiltersValue>) => onChange({ ...value, ...patch })
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <div className="relative col-span-2">
        <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-ink-muted" />
        <Input className="pl-9" placeholder="Cari catatan…" value={value.search} onChange={(e) => set({ search: e.target.value })} aria-label="Cari" />
      </div>
      <Select value={value.type} onChange={(e) => set({ type: e.target.value })}>
        <option value="">Semua tipe</option>
        <option value="income">Pemasukan</option>
        <option value="expense">Pengeluaran</option>
        <option value="transfer">Transfer</option>
      </Select>
      <Select value={value.accountId} onChange={(e) => set({ accountId: e.target.value })}>
        <option value="">Semua akun</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </Select>
      <Select value={value.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
        <option value="">Semua kategori</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} aria-label="Dari tanggal" className="!px-2" />
        <Input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} aria-label="Sampai tanggal" className="!px-2" />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/components/receipt src/components/transaction
git commit -m "feat: add transaction form, receipt upload, list, and filters"
```

---

### Task 9: Halaman Transaksi

**Files:**
- Create: `src/pages/TransactionsPage.tsx`

**Interfaces:**
- Consumes: Task 8 components, hooks Task 6.

- [ ] **Step 1: `src/pages/TransactionsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTransactions, useDeleteTransaction } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { TransactionList } from '../components/transaction/TransactionList'
import { TransactionFilters, emptyFilters } from '../components/transaction/TransactionFilters'
import type { TxFiltersValue } from '../components/transaction/TransactionFilters'
import { TransactionForm } from '../components/transaction/TransactionForm'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/Toast'
import type { Transaction } from '../types/database'

export default function TransactionsPage() {
  const { data: transactions, isLoading } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const deleteTx = useDeleteTransaction()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [filters, setFilters] = useState<TxFiltersValue>(emptyFilters)

  const accountsById = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const list = transactions ?? []
    const q = filters.search.toLowerCase().trim()
    return list.filter((t) => {
      if (filters.type && t.type !== filters.type) return false
      if (filters.accountId && t.account_id !== filters.accountId && t.to_account_id !== filters.accountId) return false
      if (filters.categoryId && t.category_id !== filters.categoryId) return false
      if (filters.from && t.date < filters.from) return false
      if (filters.to && t.date > filters.to) return false
      if (q) {
        const accName = accountsById[t.account_id]?.name.toLowerCase() ?? ''
        const catName = t.category_id ? categoriesById[t.category_id]?.name.toLowerCase() ?? '' : ''
        const note = t.note.toLowerCase()
        if (!accName.includes(q) && !catName.includes(q) && !note.includes(q)) return false
      }
      return true
    })
  }, [transactions, filters, accountsById, categoriesById])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing(t)
    setFormOpen(true)
  }
  const confirmDelete = async () => {
    if (!deleting) return
    await deleteTx.mutateAsync(deleting.id)
    toast('Transaksi dihapus')
    setDeleting(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Transaksi</h1>
          <p className="text-sm text-ink-muted">Catat pemasukan, pengeluaran, dan transfer</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <TransactionFilters value={filters} onChange={setFilters} accounts={accounts ?? []} categories={categories ?? []} />

      <TransactionList
        transactions={filtered}
        accountsById={accountsById}
        categoriesById={categoriesById}
        onEdit={openEdit}
        onDelete={setDeleting}
      />

      <TransactionForm open={formOpen} onClose={() => { setFormOpen(false); setSearchParams({}, { replace: true }) }} editing={editing} />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus transaksi?"
        message="Transaksi ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/pages/TransactionsPage.tsx
git commit -m "feat: add transactions page with search, filters, and CRUD"
```

---

### Task 10: Dashboard

**Files:**
- Create: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: hooks Task 6, `computeAccountBalances`/`totalBalance`, `formatRupiah`, Recharts.

- [ ] **Step 1: `src/pages/DashboardPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { format, subMonths } from 'date-fns'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { computeAccountBalances, totalBalance } from '../lib/balances'
import { formatRupiah } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { TransactionForm } from '../components/transaction/TransactionForm'

const COLORS = ['#10b981', '#38bdf8', '#f59e0b', '#a78bfa', '#f43f5e', '#34d399', '#fbbf24', '#818cf8', '#2dd4bf', '#fb7185']

export default function DashboardPage() {
  const { data: transactions, isLoading } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const [formOpen, setFormOpen] = useState(false)

  const balances = useMemo(
    () => computeAccountBalances(accounts ?? [], transactions ?? []),
    [accounts, transactions],
  )
  const total = useMemo(() => totalBalance(balances), [balances])

  const { monthly, categoryBreakdown, recent } = useMemo(() => {
    const txs = transactions ?? []
    const now = new Date()
    const months: { key: string; label: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i)
      months.push({ key: format(m, 'yyyy-MM'), label: format(m, 'MMM'), income: 0, expense: 0 })
    }
    const monthMap = new Map(months.map((m) => [m.key, m]))
    const catTotals = new Map<string, number>()
    for (const t of txs) {
      const bucket = monthMap.get(t.date.slice(0, 7))
      if (bucket) {
        if (t.type === 'income') bucket.income += Number(t.amount)
        else if (t.type === 'expense') bucket.expense += Number(t.amount)
      }
      if (t.type === 'expense' && t.date.slice(0, 7) === format(now, 'yyyy-MM') && t.category_id) {
        catTotals.set(t.category_id, (catTotals.get(t.category_id) ?? 0) + Number(t.amount))
      }
    }
    const categoryBreakdown = [...catTotals.entries()]
      .map(([id, value]) => ({ id, value, name: categories?.find((c) => c.id === id)?.name ?? 'Lainnya' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
    const recent = [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 5)
    return { monthly: months, categoryBreakdown, recent }
  }, [transactions, categories])

  const accountsById = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.id, c])), [categories])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const monthIncome = monthly[5]?.income ?? 0
  const monthExpense = monthly[5]?.expense ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-muted">Ringkasan keuanganmu</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah Transaksi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="flex items-center gap-2 text-sm text-ink-muted"><Wallet className="h-4 w-4" /> Total Saldo</p>
          <p className="mt-2 text-2xl font-bold text-ink tabular">{formatRupiah(total)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="flex items-center gap-2 text-sm text-ink-muted"><TrendingUp className="h-4 w-4 text-good" /> Pemasukan bulan ini</p>
          <p className="mt-2 text-2xl font-bold text-good tabular">{formatRupiah(monthIncome)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="flex items-center gap-2 text-sm text-ink-muted"><TrendingDown className="h-4 w-4 text-bad" /> Pengeluaran bulan ini</p>
          <p className="mt-2 text-2xl font-bold text-bad tabular">{formatRupiah(monthExpense)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Pemasukan vs Pengeluaran</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#233052" />
              <XAxis dataKey="label" stroke="#8ea0c3" fontSize={11} />
              <YAxis stroke="#8ea0c3" fontSize={11} tickFormatter={(v: number) => (v >= 1000000 ? `${Math.round(v / 1000000)}jt` : `${Math.round(v / 1000)}rb`)} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} contentStyle={{ background: '#111a2e', border: '1px solid #233052', borderRadius: 12 }} />
              <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Pengeluaran per Kategori (bulan ini)</h2>
          {categoryBreakdown.length === 0 ? (
            <EmptyState title="Belum ada data" message="Pengeluaran bulan ini akan tampil di sini." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {categoryBreakdown.map((entry, i) => (
                    <Cell key={entry.id} fill={categories?.find((c) => c.id === entry.id)?.color ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatRupiah(v)} contentStyle={{ background: '#111a2e', border: '1px solid #233052', borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Transaksi Terbaru</h2>
          <Link to="/transactions" className="text-sm text-good hover:underline">Lihat semua</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Belum ada transaksi" message="Mulai catat pemasukan atau pengeluaran pertamamu." />
        ) : (
          <div className="space-y-2">
            {recent.map((t) => {
              const meta =
                t.type === 'income'
                  ? { sign: '+', cls: 'text-good', label: categoriesById[t.category_id ?? '']?.name ?? 'Pemasukan' }
                  : t.type === 'expense'
                    ? { sign: '-', cls: 'text-bad', label: categoriesById[t.category_id ?? '']?.name ?? 'Pengeluaran' }
                    : { sign: '⇄', cls: 'text-move', label: 'Transfer' }
              return (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-surface-soft/50 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{meta.label}</p>
                    <p className="text-xs text-ink-muted">{accountsById[t.account_id]?.name ?? '?'} · {t.date.slice(8, 10)}/{t.date.slice(5, 7)}</p>
                  </div>
                  <div className={`tabular text-sm font-semibold ${meta.cls}`}>{meta.sign} {formatRupiah(t.amount)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/pages/DashboardPage.tsx
git commit -m "feat: add dashboard with stats, charts, and recent transactions"
```

---

### Task 11: Halaman Akun + modal transfer

**Files:**
- Create: `src/pages/AccountsPage.tsx`, `src/components/account/AccountForm.tsx`, `src/components/account/TransferModal.tsx`

**Interfaces:**
- Consumes: hooks (accounts, transactions, create), `computeAccountBalances`, `formatRupiah`.
- Produces: `AccountForm({ open, onClose, editing? })`, `TransferModal({ open, onClose })`.

- [ ] **Step 1: `src/components/account/AccountForm.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useCreateAccount, useUpdateAccount } from '../../hooks/useAccounts'
import { parseAmountInput } from '../../lib/format'
import type { Account, AccountType } from '../../types/database'

const typeLabels: Record<AccountType, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-wallet',
  other: 'Lainnya',
}

export function AccountForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Account | null
}) {
  const createAcc = useCreateAccount()
  const updateAcc = useUpdateAccount()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('bank')
  const [balanceRaw, setBalanceRaw] = useState('')
  const [color, setColor] = useState('#10b981')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setBalanceRaw(String(editing.opening_balance))
      setColor(editing.color)
    } else {
      setName('')
      setType('bank')
      setBalanceRaw('')
      setColor('#10b981')
    }
  }, [open, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('Nama akun wajib diisi', 'error')
      return
    }
    let opening_balance = 0
    if (balanceRaw.trim() !== '') {
      if (parseAmountInput(balanceRaw) === null) {
        toast('Saldo tidak valid', 'error')
        return
      }
      opening_balance = parseAmountInput(balanceRaw)!
    }
    setSaving(true)
    try {
      if (editing) {
        await updateAcc.mutateAsync({ id: editing.id, name: name.trim(), type, opening_balance, color })
        toast('Akun diperbarui')
      } else {
        await createAcc.mutateAsync({ name: name.trim(), type, opening_balance, color })
        toast('Akun ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan akun', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Akun' : 'Tambah Akun'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nama akun" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: BRI, GoPay, Dompet" />
        <Select label="Tipe" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input label="Saldo awal (Rp)" inputMode="numeric" value={balanceRaw} onChange={(e) => setBalanceRaw(e.target.value)} placeholder="0" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Warna</span>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border-subtle bg-surface-soft" />
            <span className="text-sm text-ink-muted">{color}</span>
          </div>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: `src/components/account/TransferModal.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useAccounts } from '../../hooks/useAccounts'
import { useCreateTransaction } from '../../hooks/useTransactions'
import { parseAmountInput, formatRupiah } from '../../lib/format'
import { todayISO } from '../../lib/dates'

export function TransferModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: accounts } = useAccounts()
  const createTx = useCreateTransaction()
  const { toast } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const active = useMemo(() => (accounts ?? []).filter((a) => !a.is_archived), [accounts])

  useEffect(() => {
    if (open && active.length > 0) {
      setFrom(active[0].id)
      setTo('')
      setAmountRaw('')
      setDate(todayISO())
      setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!from || !to) {
      toast('Pilih akun asal dan tujuan', 'error')
      return
    }
    if (from === to) {
      toast('Akun asal dan tujuan tidak boleh sama', 'error')
      return
    }
    const amount = parseAmountInput(amountRaw)
    if (amount === null) {
      toast('Masukkan jumlah yang valid', 'error')
      return
    }
    setSaving(true)
    try {
      await createTx.mutateAsync({
        account_id: from,
        type: 'transfer',
        category_id: null,
        amount,
        to_account_id: to,
        note,
        date,
        receipt_url: null,
      })
      toast('Transfer berhasil')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal transfer', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Transfer Antar Akun">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Dari akun" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Pilih…</option>
            {active.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select label="Ke akun" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Pilih…</option>
            {active.filter((a) => a.id !== from).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
        <div className="relative">
          <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
          {parseAmountInput(amountRaw) !== null && (
            <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">= {formatRupiah(parseAmountInput(amountRaw)!)}</span>
          )}
        </div>
        <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: transfer ke tabungan" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Transfer'}</Button>
        </div>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 3: `src/pages/AccountsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, Pencil, Archive, Trash2 } from 'lucide-react'
import { useAccounts, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { computeAccountBalances } from '../lib/balances'
import { formatRupiah } from '../lib/format'
import { AccountForm } from '../components/account/AccountForm'
import { TransferModal } from '../components/account/TransferModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import type { Account } from '../types/database'

const typeLabels: Record<string, string> = { cash: 'Tunai', bank: 'Bank', ewallet: 'E-wallet', other: 'Lainnya' }

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const { data: transactions } = useTransactions()
  const deleteAcc = useDeleteAccount()
  const archiveAcc = useUpdateAccount()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [deleting, setDeleting] = useState<Account | null>(null)

  const balances = useMemo(
    () => computeAccountBalances(accounts ?? [], transactions ?? []),
    [accounts, transactions],
  )

  const txCountByAccount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of transactions ?? []) {
      counts[t.account_id] = (counts[t.account_id] ?? 0) + 1
      if (t.to_account_id) counts[t.to_account_id] = (counts[t.to_account_id] ?? 0) + 1
    }
    return counts
  }, [transactions])

  const list = (accounts ?? []).filter((a) => !a.is_archived)
  const archived = (accounts ?? []).filter((a) => a.is_archived)

  const openEdit = (a: Account) => {
    setEditing(a)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    if ((txCountByAccount[deleting.id] ?? 0) > 0) {
      toast('Akun ini punya transaksi — arsipkan saja, tidak bisa dihapus', 'error')
      setDeleting(null)
      return
    }
    await deleteAcc.mutateAsync(deleting.id)
    toast('Akun dihapus')
    setDeleting(null)
  }

  const toggleArchive = async (a: Account) => {
    await archiveAcc.mutateAsync({ id: a.id, is_archived: !a.is_archived })
    toast(a.is_archived ? 'Akun diaktifkan kembali' : 'Akun diarsipkan')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const renderCard = (a: Account) => (
    <div key={a.id} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: a.color }} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{a.name}</h3>
        <span className="text-xs text-ink-muted">{typeLabels[a.type]}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-ink tabular">{formatRupiah(balances[a.id] ?? 0)}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-ink-muted">{txCountByAccount[a.id] ?? 0} transaksi</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(a)} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => toggleArchive(a)} aria-label={a.is_archived ? 'Aktifkan' : 'Arsipkan'}>
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(a)} aria-label="Hapus" className="text-bad">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Akun</h1>
          <p className="text-sm text-ink-muted">Sumber dana dan transfer antar akun</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="h-4 w-4" /> Transfer
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Tambah Akun
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Belum ada akun" message="Buat akun pertama (tunai, bank, atau e-wallet) untuk mulai mencatat." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(renderCard)}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">Diarsipkan</h2>
          <div className="grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map(renderCard)}
          </div>
        </div>
      )}

      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus akun?"
        message="Akun yang punya transaksi tidak bisa dihapus dan harus diarsipkan."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/pages/AccountsPage.tsx src/components/account
git commit -m "feat: add accounts page with transfer and archive"
```

---

### Task 12: Halaman Kategori

**Files:**
- Create: `src/pages/CategoriesPage.tsx`

**Interfaces:**
- Consumes: `useCategories` hooks, UI primitives, lucide-react icon map.

- [ ] **Step 1: `src/pages/CategoriesPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus, Pencil, Trash2, Tag, ShoppingCart, Utensils, Car, Home, Zap, Smartphone,
  Tv, Plane, Gift, Briefcase, Banknote, HeartPulse, GraduationCap, Gamepad2, Wifi,
} from 'lucide-react'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../hooks/useCategories'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { Category, CategoryType } from '../types/database'

const ICONS: Record<string, typeof Tag> = {
  tag: Tag, shopping: ShoppingCart, food: Utensils, car: Car, home: Home, energy: Zap,
  phone: Smartphone, entertainment: Tv, travel: Plane, gift: Gift, salary: Briefcase,
  income: Banknote, health: HeartPulse, education: GraduationCap, game: Gamepad2, internet: Wifi,
}

export function CategoryForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Category | null
}) {
  const createCat = useCreateCategory()
  const updateCat = useUpdateCategory()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [icon, setIcon] = useState('tag')
  const [color, setColor] = useState('#38bdf8')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setIcon(editing.icon)
      setColor(editing.color)
    } else {
      setName('')
      setType('expense')
      setIcon('tag')
      setColor('#38bdf8')
    }
  }, [open, editing])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast('Nama kategori wajib diisi', 'error')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCat.mutateAsync({ id: editing.id, name: name.trim(), type, icon, color })
        toast('Kategori diperbarui')
      } else {
        await createCat.mutateAsync({ name: name.trim(), type, icon, color })
        toast('Kategori ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan kategori', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Kategori' : 'Tambah Kategori'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nama kategori" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Makanan" />
        <Select label="Tipe" value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
          <option value="expense">Pengeluaran</option>
          <option value="income">Pemasukan</option>
        </Select>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Ikon</span>
          <div className="grid grid-cols-8 gap-2">
            {Object.entries(ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
                className={`flex items-center justify-center rounded-lg border p-2 transition-colors ${
                  icon === key
                    ? 'border-good bg-good/15 text-good'
                    : 'border-border-subtle text-ink-muted hover:text-ink'
                }`}
                aria-label={`Ikon ${key}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Warna</span>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border-subtle bg-surface-soft" />
            <span className="text-sm text-ink-muted">{color}</span>
          </div>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const deleteCat = useDeleteCategory()
  const { toast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const confirmDelete = async () => {
    if (!deleting) return
    await deleteCat.mutateAsync(deleting.id)
    toast('Kategori dihapus')
    setDeleting(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const renderGroup = (type: CategoryType, label: string) => {
    const items = (categories ?? []).filter((c) => c.type === type)
    return (
      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">{label}</h2>
        {items.length === 0 ? (
          <EmptyState title={`Belum ada kategori ${label.toLowerCase()}`} />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => {
              const Icon = ICONS[c.icon] ?? Tag
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${c.color}22`, color: c.color }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink">{c.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setFormOpen(true) }} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} aria-label="Hapus" className="text-bad">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Kategori</h1>
          <p className="text-sm text-ink-muted">Kelola kategori pemasukan dan pengeluaran</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah Kategori
        </Button>
      </div>

      {renderGroup('expense', 'Pengeluaran')}
      {renderGroup('income', 'Pemasukan')}

      <CategoryForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus kategori?"
        message="Transaksi yang memakai kategori ini tetap ada, hanya saja kategorinya dihapus."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/pages/CategoriesPage.tsx
git commit -m "feat: add categories page with icon picker"
```

---

### Task 13: Halaman Transaksi Berulang

**Files:**
- Create: `src/pages/RecurringPage.tsx`

**Interfaces:**
- Consumes: `useRecurring` hooks, `useCreateTransaction`, `advanceDate`, `todayISO`, `formatRupiah`.
- Fitur "Catat sekarang": buat transaksi lalu geser `next_due_date` via `advanceDate`.

- [ ] **Step 1: `src/pages/RecurringPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, CalendarClock, CheckCircle2, Circle } from 'lucide-react'
import { useRecurring, useCreateRecurring, useUpdateRecurring, useDeleteRecurring } from '../hooks/useRecurring'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useCreateTransaction } from '../hooks/useTransactions'
import { formatRupiah } from '../lib/format'
import { todayISO, advanceDate, formatDay } from '../lib/dates'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import type { Frequency, RecurringTransaction } from '../types/database'

const frequencyLabels: Record<Frequency, string> = { weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }

export function RecurringForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: RecurringTransaction | null
}) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createRec = useCreateRecurring()
  const updateRec = useUpdateRecurring()
  const { toast } = useToast()

  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [nextDue, setNextDue] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const active = useMemo(() => (accounts ?? []).filter((a) => !a.is_archived), [accounts])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setName(editing.name)
      setType(editing.type)
      setAccountId(editing.account_id)
      setCategoryId(editing.category_id ?? '')
      setAmountRaw(String(editing.amount))
      setFrequency(editing.frequency)
      setNextDue(editing.next_due_date)
    } else {
      setName('')
      setType('expense')
      setAccountId(active[0]?.id ?? '')
      setCategoryId('')
      setAmountRaw('')
      setFrequency('monthly')
      setNextDue(todayISO())
    }
  }, [open, editing, active])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(amountRaw.replace(/[^\d]/g, ''))
    if (!name.trim()) {
      toast('Nama wajib diisi', 'error')
      return
    }
    if (!accountId) {
      toast('Pilih akun', 'error')
      return
    }
    if (!(amount > 0)) {
      toast('Jumlah harus lebih dari 0', 'error')
      return
    }
    if (!nextDue) {
      toast('Tanggal jatuh tempo wajib diisi', 'error')
      return
    }
    const cat = (categories ?? []).find((c) => c.id === categoryId)
    if (type === 'expense' ? cat && cat.type !== 'expense' : cat && cat.type !== 'income') {
      toast('Kategori tidak sesuai tipe', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        account_id: accountId,
        category_id: categoryId || null,
        amount,
        frequency,
        next_due_date: nextDue,
        is_active: true,
      }
      if (editing) {
        await updateRec.mutateAsync({ id: editing.id, ...payload })
        toast('Transaksi berulang diperbarui')
      } else {
        await createRec.mutateAsync(payload)
        toast('Transaksi berulang ditambahkan')
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaksi Berulang' : 'Tambah Transaksi Berulang'}>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nama tagihan" value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Listrik bulanan" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Tipe" value={type} onChange={(e) => setType(e.target.value as 'income' | 'expense')}>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </Select>
          <Select label="Frekuensi" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </Select>
        </div>
        <Select label="Akun" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Pilih akun…</option>
          {active.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tanpa kategori</option>
          {(categories ?? []).filter((c) => c.type === type).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
        <Input label="Jatuh tempo berikutnya" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function RecurringPage() {
  const { data: recurring, isLoading } = useRecurring()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createTx = useCreateTransaction()
  const updateRec = useUpdateRecurring()
  const deleteRec = useDeleteRecurring()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [deleting, setDeleting] = useState<RecurringTransaction | null>(null)
  const [recording, setRecording] = useState<string | null>(null)

  const accountsById = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.id, c])), [categories])

  const toggleActive = async (r: RecurringTransaction) => {
    await updateRec.mutateAsync({ id: r.id, is_active: !r.is_active })
    toast(r.is_active ? 'Dinonaktifkan' : 'Diaktifkan')
  }

  const recordNow = async (r: RecurringTransaction) => {
    setRecording(r.id)
    try {
      await createTx.mutateAsync({
        account_id: r.account_id,
        type: r.type,
        category_id: r.category_id,
        amount: Number(r.amount),
        to_account_id: null,
        note: r.name,
        date: todayISO(),
        receipt_url: null,
      })
      await updateRec.mutateAsync({ id: r.id, next_due_date: advanceDate(r.next_due_date, r.frequency) })
      toast('Dicatat hari ini, jatuh tempo digeser')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mencatat', 'error')
    } finally {
      setRecording(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const activeItems = (recurring ?? []).filter((r) => r.is_active)
  const idleItems = (recurring ?? []).filter((r) => !r.is_active)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Transaksi Berulang</h1>
          <p className="text-sm text-ink-muted">Tagihan dan pemasukan terjadwal</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <div className="space-y-2">
        {activeItems.length === 0 && idleItems.length === 0 && (
          <EmptyState title="Belum ada transaksi berulang" message="Tambahkan tagihan bulanan seperti listrik atau internet." />
        )}
        {activeItems.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-card px-4 py-3">
            <button onClick={() => toggleActive(r)} aria-label="Nonaktifkan">
              <CheckCircle2 className="h-5 w-5 text-good" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{r.name}</p>
              <p className="text-xs text-ink-muted">
                {accountsById[r.account_id]?.name ?? '?'} · {categoriesById[r.category_id ?? '']?.name ?? 'Tanpa kategori'} · {frequencyLabels[r.frequency]}
              </p>
            </div>
            <div className="text-right">
              <p className={`tabular text-sm font-semibold ${r.type === 'expense' ? 'text-bad' : 'text-good'}`}>
                {r.type === 'expense' ? '-' : '+'}{formatRupiah(Number(r.amount))}
              </p>
              <p className="text-xs text-ink-muted">Jatuh tempo {formatDay(r.next_due_date)}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => recordNow(r)} disabled={recording === r.id} aria-label="Catat sekarang">
                <CalendarClock className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setFormOpen(true) }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label="Hapus" className="text-bad">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {idleItems.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-card/50 px-4 py-3 opacity-70">
            <button onClick={() => toggleActive(r)} aria-label="Aktifkan">
              <Circle className="h-5 w-5 text-ink-muted" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink line-through">{r.name}</p>
              <p className="text-xs text-ink-muted">{frequencyLabels[r.frequency]} · nonaktif</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setFormOpen(true) }} aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(r)} aria-label="Hapus" className="text-bad">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <RecurringForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus transaksi berulang?"
        message="Jadwal ini akan dihapus. Transaksi yang sudah tercatat tidak terpengaruh."
        onConfirm={async () => {
          if (!deleting) return
          await deleteRec.mutateAsync(deleting.id)
          toast('Transaksi berulang dihapus')
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/pages/RecurringPage.tsx
git commit -m "feat: add recurring transactions page with record-now"
```

---

### Task 14: Halaman Laporan + export CSV

**Files:**
- Create: `src/pages/ReportsPage.tsx`, `src/lib/csv.ts`

**Interfaces:**
- Consumes: hooks Task 6, `formatRupiah`, `monthRange`.
- Produces:
  - `toCSV(rows: (string | number)[][]): string`
  - `downloadFile(filename: string, content: string, type: string)`

- [ ] **Step 1: `src/lib/csv.ts` (+ unit test)**

`src/lib/csv.ts`:

```ts
export function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['\uFEFF' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

`src/lib/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toCSV } from './csv'

describe('toCSV', () => {
  it('escapes quotes and joins with comma', () => {
    expect(toCSV([['a', 'b"c'], [1, 2]])).toBe('"a","b""c"\n"1","2"')
  })
})
```

- [ ] **Step 2: `src/pages/ReportsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { formatRupiah } from '../lib/format'
import { toCSV, downloadFile } from '../lib/csv'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'

interface MonthOption { value: string; label: string }

export default function ReportsPage() {
  const { data: transactions, isLoading } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const now = new Date()
  const [month, setMonth] = useState(format(now, 'yyyy-MM'))

  const months: MonthOption[] = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions ?? []) set.add(t.date.slice(0, 7))
    set.add(format(now, 'yyyy-MM'))
    return [...set].sort().reverse().map((m) => ({ value: m, label: m }))
  }, [transactions, now])

  const report = useMemo(() => {
    const monthTxs = (transactions ?? []).filter((t) => t.date.slice(0, 7) === month)
    const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const byCategory = new Map<string, { name: string; total: number }>()
    for (const t of monthTxs) {
      if (t.type !== 'expense') continue
      const name = t.category_id ? categories?.find((c) => c.id === t.category_id)?.name ?? 'Tanpa kategori' : 'Tanpa kategori'
      const cur = byCategory.get(name) ?? { name, total: 0 }
      cur.total += Number(t.amount)
      byCategory.set(name, cur)
    }
    const rows = [...byCategory.values()].sort((a, b) => b.total - a.total)
    return { income, expense, rows }
  }, [transactions, categories, month])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Tanggal', 'Tipe', 'Akun', 'Kategori', 'Jumlah', 'Catatan'],
      ...(transactions ?? [])
        .filter((t) => t.date.slice(0, 7) === month)
        .map((t) => [
          t.date,
          t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
          accounts?.find((a) => a.id === t.account_id)?.name ?? '',
          t.category_id ? categories?.find((c) => c.id === t.category_id)?.name ?? '' : '',
          t.type === 'income' ? Number(t.amount) : -Number(t.amount),
          t.note,
        ]),
    ]
    downloadFile(`cashflow-${month}.csv`, toCSV(rows))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Laporan</h1>
          <p className="text-sm text-ink-muted">Rekap bulanan dan export</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Pilih bulan">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="text-sm text-ink-muted">Pemasukan</p>
          <p className="mt-2 text-2xl font-bold text-good tabular">{formatRupiah(report.income)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="text-sm text-ink-muted">Pengeluaran</p>
          <p className="mt-2 text-2xl font-bold text-bad tabular">{formatRupiah(report.expense)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="text-sm text-ink-muted">Selisih</p>
          <p className={`mt-2 text-2xl font-bold tabular ${report.income - report.expense >= 0 ? 'text-good' : 'text-bad'}`}>
            {formatRupiah(report.income - report.expense)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Rincian Pengeluaran per Kategori</h2>
        {report.rows.length === 0 ? (
          <EmptyState title="Tidak ada pengeluaran bulan ini" />
        ) : (
          <div className="space-y-2">
            {report.rows.map((row) => (
              <div key={row.name} className="flex items-center justify-between">
                <span className="text-sm text-ink">{row.name}</span>
                <span className="text-sm font-medium text-ink tabular">{formatRupiah(row.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verifikasi & commit**

```powershell
npm test
npm run build
npm run lint
git add src/pages/ReportsPage.tsx src/lib/csv.ts src/lib/csv.test.ts
git commit -m "feat: add reports page with monthly summary and CSV export"
```

---

### Task 15: Halaman Pengaturan — profil, backup/import

**Files:**
- Create: `src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `useAuth`, `supabase`, hooks Task 6, `downloadFile`.
- Fitur: update nama profil, export backup JSON semua data, import JSON.

- [ ] **Step 1: `src/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useRecurring } from '../hooks/useRecurring'
import { downloadFile } from '../lib/csv'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import type { Account, Category, RecurringTransaction, Transaction } from '../types/database'

export default function SettingsPage() {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: transactions } = useTransactions()
  const { data: recurring } = useRecurring()
  const { toast } = useToast()

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    setFullName(user?.user_metadata?.full_name ?? '')
  }, [user])

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } })
    setSavingName(false)
    if (error) {
      toast(error.message, 'error')
      return
    }
    toast('Nama diperbarui')
  }

  const exportBackup = () => {
    const backup = {
      version: 1,
      exported_at: new Date().toISOString(),
      accounts: accounts ?? [],
      categories: categories ?? [],
      transactions: transactions ?? [],
      recurring: recurring ?? [],
    }
    downloadFile(`cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
  }

  const importBackup = async (file: File) => {
    const text = await file.text()
    let data: {
      accounts?: Account[]
      categories?: Category[]
      transactions?: Transaction[]
      recurring?: RecurringTransaction[]
    }
    try {
      data = JSON.parse(text)
    } catch {
      toast('File JSON tidak valid', 'error')
      return
    }
    if (!Array.isArray(data.accounts) && !Array.isArray(data.categories)) {
      toast('Struktur backup tidak dikenali', 'error')
      return
    }
    if (!user) return
    const stripUser = (rows: Array<Record<string, unknown>>) =>
      rows.map(({ user_id, id, created_at, updated_at, ...rest }) => rest)

    const tasks: Array<Promise<void>> = []
    const push = async (table: 'accounts' | 'categories' | 'transactions' | 'recurring_transactions', rows: unknown[]) => {
      if (rows.length === 0) return
      const { error } = await supabase.from(table).insert(stripUser(rows as Array<Record<string, unknown>>))
      if (error) throw error
    }
    try {
      if (Array.isArray(data.accounts)) tasks.push(push('accounts', data.accounts))
      if (Array.isArray(data.categories)) tasks.push(push('categories', data.categories))
      if (Array.isArray(data.transactions)) tasks.push(push('transactions', data.transactions))
      if (Array.isArray(data.recurring)) tasks.push(push('recurring_transactions', data.recurring))
      await Promise.all(tasks)
      toast('Data berhasil diimpor')
    } catch (err) {
      toast(`Gagal impor: ${err instanceof Error ? err.message : 'bukan akunmu'}`, 'error')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Pengaturan</h1>
        <p className="text-sm text-ink-muted">Profil dan manajemen data</p>
      </div>

      <form onSubmit={saveName} className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Profil</h2>
        <div className="space-y-3">
          <Input label="Nama" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Email" value={user?.email ?? ''} disabled />
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={savingName}>{savingName ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">Data</h2>
        <p className="mb-4 text-sm text-ink-muted">Backup semua data ke file JSON, atau pulihkan dari backup.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            <Download className="h-4 w-4" /> Export Backup
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-card">
              <Upload className="h-4 w-4" /> Import Backup
            </span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
```

> Catatan impor: field `user_id`, `id`, `created_at`, `updated_at` dari backup dibuang; id baru di-generate DB. Karena akun/kategori diimpor dengan id baru, transaksi lama yang di-backup tidak akan ter-link ke akun baru tanpa pemetaan. Untuk rencana ini: transaksi diimpor apa adanya dari data original *hanya jika* id masih sama (pemulihan ke akun sama). Ini adalah perilaku yang didokumentasikan: backup/restore ditujukan untuk migrasi perangkat ke akun yang sama, bukan penggabungan multi-user.

- [ ] **Step 2: Verifikasi & commit**

```powershell
npm run build
npm run lint
git add src/pages/SettingsPage.tsx
git commit -m "feat: add settings page with profile and backup/import"
```

---

### Task 16: Polish, review-toxicity & verifikasi akhir

**Files:**
- Modify: seluruh `src/` bila ditemukan cacat.

**Interfaces:**
- Consumes: seluruh fitur aplikasi.
- Produces: aplikasi siap pakai, lolos pengujian menyeluruh.

- [ ] **Step 1: Lint, typecheck, dan test penuh**

```powershell
npm run lint
npm run build
npm test
```

Expected: semua lulus tanpa warning blokir.

- [ ] **Step 2: Self-review toksisitas kode (hapus semua "AI slop")**

Periksa & perbaiki jika ada:
- Label/placeholder generik atau datar: ganti dengan Bahasa Indonesia yang natural, spesifik, dan tidak kaku (mis. jangan `placeholder="Enter amount"`), setiap pesan error memberi tahu apa yang salah dan apa yang harus dilakukan.
- Pseudo-feature yang tidak berfungsi (tombol tanpa handler, empty state tanpa aksi) — hapus atau lengkapi.
- Skema warna merah-hijau yang kontras kurang untuk aksesibilitas; pastikan teks `ink-muted` cukup terbaca di `surface`.
- Konsistensi bahasa 100% Indonesia di seluruh UI (dsb. label tombol, alt text, aria-label).
- Dead code / import tidak terpakai (sudah dijamin oleh `noUnusedLocals` + ESLint).
- Duplikasi logika antar halaman yang sebaiknya di-ekstrak.

- [ ] **Step 3: Uji manual alur inti di browser**

```powershell
npm run dev
```

Buka di browser (Chrome/Edge), jalankan checklist:
1. Registrasi akun baru → redirect ke login.
2. Login → dashboard muncul.
3. Tambah akun "Tunai" (saldo awal 100.000).
4. Tambah kategori "Makanan".
5. Tambah transaksi pengeluaran 15.000 di akun Tunai, kategori Makanan, upload foto struk → cek pratinjau, simpan.
6. Dashboard menampilkan saldo 85.000, pengeluaran bulan ini 15.000, donut kategori menampilkan Makanan.
7. Halaman Transaksi: cari "Makanan", filter tipe, buka bukti (lightbox), edit transaksi, hapus transaksi (konfirmasi).
8. Transfer 10.000 dari Tunai ke akun bank (buat akun bank dulu) → saldo kedua akun benar.
9. Tambah transaksi berulang bulanan → tombol "catat sekarang" membuat transaksi dan menggeser jatuh tempo.
10. Laporan: pilih bulan → ringkasan benar → export CSV terbuka berisi data.
11. Kategori: tambah/edit/hapus (hapus → transaksi tetap ada).
12. Pengaturan: ganti nama, export backup JSON, import backup.
13. Responsif: gunakan devtools mobile viewport → MobileNav dan FAB tampil; tidak ada tumpang tindih.
14. Logout → kembali ke login.
15. Refresh halaman → data tetap ada (persistend).

Perbaiki semua cacat yang ditemukan; ulangi langkah 1-3 sampai bersih.

- [ ] **Step 4: Verifikasi kualitas final + commit**

```powershell
npm run lint; if ($?) { npm run build }; if ($?) { npm test }
```

Expected: semua hijau. Lalu:

```powershell
git add -A
git commit -m "feat: final polish and verification pass"
```

- [ ] **Step 5: Laporkan hasil ke user**

Ringkas: apa yang dibangun, cara menjalankan, kredensial yang perlu diisi user (`.env`, project Supabase), dan hasil verifikasi (lint/build/test/manual).