# Multi-User Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Cashflow from per-user email/password login into a 3-member app (Bima, Aska, Nanda) with card-based login, per-member data, shared read access, and a per-member + global dashboard.

**Architecture:** Keep Supabase Auth with 3 fixed internal accounts (`bima@cashflow.local`, `aska@cashflow.local`, `nanda@cashflow.local`). Data stays per-user (`user_id`); RLS is changed to allow all authenticated members to SELECT all rows but only INSERT/UPDATE/DELETE their own. A server-side Edge Function bootstrap creates the 3 accounts on first run (tracked by an `app_settings` row). The frontend maps the logged-in user to a member slot to decide read-write vs read-only, and provides a member filter plus per-member/global dashboards.

**Tech Stack:** React 19, TypeScript, Vite, Supabase (Auth + Postgres RLS + Edge Functions), TanStack Query, Tailwind CSS v4, date-fns, recharts, Lucide.

## Global Constraints

- TypeScript strict — no `any`, no loose types.
- RLS must enforce boundaries at the server level; never rely solely on UI.
- Service Role credentials must never ship to the client — account creation happens only in the Edge Function.
- No inline comments unless required to suppress a linter warning.
- Three fixed member emails (verbatim):
  - `bima@cashflow.local` → Bima
  - `aska@cashflow.local` → Aska
  - `nanda@cashflow.local` → Nanda
- Existing UI copy is in Indonesian — keep new copy Indonesian.
- Run `npm test`, `npm run lint`, `npm run build` before considering a task done.

---

### Task 1: Schema migration — shared-read RLS and members table

**Files:**
- Create: `supabase/migrations/20260820000300_multi_user_rls.sql`
- Test: DB verification via `supabase` CLI / Studio (no automated test for SQL)

**Interfaces:**
- Produces: `public.members` table (columns `id uuid PK`, `name text`, `email text unique`, `color text`, `icon text`), `public.app_settings` table (`id int PK`, `setup_complete boolean`), relaxed RLS on existing tables.

**Migration content:**

```sql
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
```

- [ ] **Step 1: Create the migration file with the content above.**
- [ ] **Step 2: Apply the migration.**
- [ ] **Step 3: Verify RLS via Studio (`supabase studio`) or SQL:**
  - As any authenticated user, a `select * from transactions` returns rows from all owners.
  - `insert` with a different `user_id` is rejected.
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260820000300_multi_user_rls.sql
git commit -m "feat: multi-user shared-read RLS and members tables"
```

---

### Task 2: Bootstrap Edge Function

**Files:**
- Create: `supabase/functions/bootstrap/index.ts`
- Create: `supabase/functions/bootstrap/deno.json`
- Test: `supabase functions serve bootstrap` + curl

**Interfaces:**
- Consumes: `app_settings`, `members` tables from Task 1.
- Produces: HTTP POST handler that (1) is a no-op if `setup_complete` is true, (2) creates the 3 auth users + member rows, (3) marks setup complete. Request body: `{ passwords: { bima: string, aska: string, nanda: string } }`. Response: `{ ok: boolean, initialized: boolean }`.

**`deno.json`:**
```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@^2"
  },
  "compilerOptions": { "strict": true }
}
```

**`index.ts`:**
```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const MEMBERS = [
  { email: 'bima@cashflow.local', name: 'Bima', color: '#10b981', icon: 'bima' },
  { email: 'aska@cashflow.local', name: 'Aska', color: '#6366f1', icon: 'aska' },
  { email: 'nanda@cashflow.local', name: 'Nanda', color: '#f59e0b', icon: 'nanda' },
]

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('setup_complete')
    .eq('id', 1)
    .maybeSingle()
  if (settings?.setup_complete) {
    return new Response(JSON.stringify({ ok: true, initialized: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { passwords?: Record<string, string> } = {}
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const passwords = body.passwords ?? {}
  for (const m of MEMBERS) {
    const password = passwords[m.email]
    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: `Password untuk ${m.name} minimal 6 karakter` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  for (const m of MEMBERS) {
    const { data: user, error: uerr } = await supabase.auth.admin.createUser({
      email: m.email,
      password: passwords[m.email],
      email_confirm: true,
      user_metadata: { full_name: m.name },
    })
    if (uerr) {
      return new Response(JSON.stringify({ error: uerr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await supabase.from('members').insert({
      id: user!.user.id,
      name: m.name,
      email: m.email,
      color: m.color,
      icon: m.icon,
    })
  }

  await supabase
    .from('app_settings')
    .upsert({ id: 1, setup_complete: true }, { onConflict: 'id' })

  return new Response(JSON.stringify({ ok: true, initialized: false }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 1: Create `deno.json` and `index.ts` with the content above.**
- [ ] **Step 2: Deploy / run locally** via `supabase functions serve bootstrap`.
- [ ] **Step 3: Smoke test** the no-op path (POST twice; second returns `initialized: true`).
- [ ] **Step 4: Commit**

```bash
git add supabase/functions/bootstrap
git commit -m "feat: bootstrap edge function for three member accounts"
```

---

### Task 3: Member/slot identity helper

**Files:**
- Create: `src/lib/members.ts`
- Test: `src/lib/members.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export const MEMBER_SLOTS: MemberSlot[]` where `MemberSlot = { email: string; name: string; color: string; icon: string }`.
  - `export function getMemberByEmail(email: string | undefined): MemberSlot | null`
  - `export function getMemberById(id: string, members: Member[]): Member | undefined` — resolves a `user_id` uuid to a member row.
  - `export function memberInitials(name: string): string`

**`src/lib/members.ts`:**
```ts
export interface MemberSlot {
  email: string
  name: string
  color: string
  icon: string
}

export const MEMBER_SLOTS: MemberSlot[] = [
  { email: 'bima@cashflow.local', name: 'Bima', color: '#10b981', icon: 'bima' },
  { email: 'aska@cashflow.local', name: 'Aska', color: '#6366f1', icon: 'aska' },
  { email: 'nanda@cashflow.local', name: 'Nanda', color: '#f59e0b', icon: 'nanda' },
]

export function getMemberByEmail(email: string | undefined): MemberSlot | null {
  if (!email) return null
  return MEMBER_SLOTS.find((m) => m.email === email) ?? null
}

export interface Member {
  id: string
  name: string
  email: string
  color: string
  icon: string
}

export function getMemberById(id: string | undefined, members: Member[]): Member | undefined {
  if (!id) return undefined
  return members.find((m) => m.id === id)
}

export function memberInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
```

**`src/lib/members.test.ts`:**
```ts
import { describe, expect, it } from 'vitest'
import {
  getMemberByEmail,
  getMemberById,
  memberInitials,
  MEMBER_SLOTS,
} from './members'

describe('members', () => {
  it('maps known emails to slots', () => {
    expect(getMemberByEmail('bima@cashflow.local')?.name).toBe('Bima')
    expect(getMemberByEmail('aska@cashflow.local')?.name).toBe('Aska')
    expect(getMemberByEmail('nanda@cashflow.local')?.name).toBe('Nanda')
  })

  it('returns null for unknown email', () => {
    expect(getMemberByEmail('x@y.z')).toBeNull()
    expect(getMemberByEmail(undefined)).toBeNull()
  })

  it('resolves a member by id', () => {
    const members = MEMBER_SLOTS.map((s, i) => ({ id: String(i), ...s }))
    expect(getMemberById('1', members)?.name).toBe('Aska')
    expect(getMemberById('nope', members)).toBeUndefined()
    expect(getMemberById(undefined, members)).toBeUndefined()
  })

  it('computes initials', () => {
    expect(memberInitials('Bima')).toBe('BI')
  })
})
```

- [ ] **Step 1: Write the failing test.**
- [ ] **Step 2: Run `npx vitest run src/lib/members.test.ts`** — expect FAIL (`Cannot find module`).
- [ ] **Step 3: Write `src/lib/members.ts`.**
- [ ] **Step 4: Run the test** — expect PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/members.ts src/lib/members.test.ts
git commit -m "feat: member slot identity helper"
```

---

### Task 4: Members query hook

**Files:**
- Create: `src/hooks/useMembers.ts`
- Test: `src/hooks/useMembers.test.tsx`

**Interfaces:**
- Consumes: `members` table (Task 1), `supabase` client.
- Produces:
  - `export function useMembers(): UseQueryResult<Member[]>` — queryKey `['members']`.
  - `export function useIsSetupComplete(): UseQueryResult<boolean>` — queryKey `['app-settings']`.

**`src/hooks/useMembers.ts`:**
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Member } from '../lib/members'

const selectMembers = async (): Promise<Member[]> => {
  const { data, error } = await supabase
    .from('members')
    .select('id, name, email, color, icon')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Member[]
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: selectMembers,
  })
}

const selectSetupComplete = async (): Promise<boolean> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('setup_complete')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return data?.setup_complete ?? false
}

export function useIsSetupComplete() {
  return useQuery({
    queryKey: ['app-settings'],
    queryFn: selectSetupComplete,
  })
}
```

**`src/hooks/useMembers.test.tsx`:** (follow existing hook test patterns from `src/hooks/useAccounts.test.tsx`)
- Mock `supabase.from('members').select(...)` returning two rows.
- Mock `supabase.from('app_settings').select(...).eq(...).maybeSingle()` returning `{ setup_complete: true }`.
- Assert `useMembers` returns the rows and `useIsSetupComplete` returns `true`.

- [ ] **Step 1: Read `src/hooks/useAccounts.test.tsx`** to mirror its mocking conventions.
- [ ] **Step 2: Write the failing tests.**
- [ ] **Step 3: Run `npx vitest run src/hooks/useMembers.test.tsx`** — expect FAIL.
- [ ] **Step 4: Write `src/hooks/useMembers.ts`.**
- [ ] **Step 5: Run the tests** — expect PASS.
- [ ] **Step 6: Commit**

```bash
git add src/hooks/useMembers.ts src/hooks/useMembers.test.tsx
git commit -m "feat: members and setup-complete query hooks"
```

---

### Task 5: SetupPage

**Files:**
- Create: `src/pages/SetupPage.tsx`
- Test: `src/pages/SetupPage.test.tsx`

**Interfaces:**
- Consumes: edge function `bootstrap`, `useIsSetupComplete`, `MEMBER_SLOTS`, `useAuth.register`.
- Produces: default-exported `SetupPage` rendering a 3-field password form; on success navigates to `/login`.

**`src/pages/SetupPage.tsx`:**
```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useIsSetupComplete } from '../hooks/useMembers'
import { MEMBER_SLOTS } from '../lib/members'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

type Passwords = Record<string, string>

export default function SetupPage() {
  const { data: setupComplete, isLoading: checking } = useIsSetupComplete()
  const [passwords, setPasswords] = useState<Passwords>({})
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <p className="text-sm text-ink-muted">Sistem sudah disetel.</p>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const values = MEMBER_SLOTS.map((m) => passwords[m.email] ?? '')
    if (values.some((v) => v.length < 6)) {
      toast('Setiap password minimal 6 karakter', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('bootstrap', {
        body: { passwords },
      })
      if (error) throw error
      toast('Pengaturan awal selesai! Silakan masuk.')
      navigate('/login')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyetel pengaturan', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-good">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Cashflow</h1>
            <p className="text-xs text-ink-muted">Pengaturan awal</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border-subtle bg-surface-card p-6">
          <h2 className="text-base font-semibold text-ink">Buat password untuk masing-masing</h2>
          {MEMBER_SLOTS.map((m) => (
            <div key={m.email}>
              <label className="mb-1 block text-sm text-ink">{m.name}</label>
              <input
                type="password"
                value={passwords[m.email] ?? ''}
                onChange={(e) => setPasswords((p) => ({ ...p, [m.email]: e.target.value }))}
                placeholder="Password"
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-good"
              />
            </div>
          ))}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Menyetel…' : 'Simpan & Lanjut'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 1: Read `src/pages/LoginPage.tsx` for styling conventions.**
- [ ] **Step 2: Write the failing test** (render, fill 3 passwords, submit, assert `supabase.functions.invoke` called with correct body, and navigate called).
- [ ] **Step 3: Run the test** — expect FAIL.
- [ ] **Step 4: Write `src/pages/SetupPage.tsx`.**
- [ ] **Step 5: Run the test** — expect PASS.
- [ ] **Step 6: Commit**

```bash
git add src/pages/SetupPage.tsx src/pages/SetupPage.test.tsx
git commit -m "feat: setup page to bootstrap member accounts"
```

---

### Task 6: Rework login to card-based selector

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/hooks/useAuth.tsx`
- Test: `src/pages/LoginPage.test.tsx` (existing — update), `src/hooks/useAuth.test.tsx` (update)

**Interfaces:**
- Consumes: `useIsSetupComplete`, `MEMBER_SLOTS`, `useAuth.login`.
- Produces:
  - `useAuth.login(email, password)` unchanged signature but always called with the selected member's internal email.
  - New `useAuth.firstUserSession()` (or add to context) is **not** needed — first-run handled by SetupPage. Keep `login` as is.

**Changes to `src/hooks/useAuth.tsx`:** No signature change. Ensure `login` already creates a profile via `ensureProfile` (it does).

**Changes to `src/pages/LoginPage.tsx`:** Replace email field with a 3-card selector. Selecting a card reveals a password field. On submit, call `login(selected.email, password)`.
- If the selected account has no password set yet, Supabase `signInWithPassword` fails; show a message directing to set the password (handled by SetupPage). Since bootstrap sets all passwords at once, all members always have passwords after setup.

Rewrite `src/pages/LoginPage.tsx`:
```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsSetupComplete } from '../hooks/useMembers'
import { MEMBER_SLOTS, memberInitials } from '../lib/members'
import { translateAuthError } from '../lib/authErrors'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function LoginPage() {
  const { data: setupComplete, isLoading } = useIsSetupComplete()
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { login } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (!setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-lg font-bold text-ink">Cashflow</h1>
          <p className="mt-1 text-sm text-ink-muted">Pengaturan awal belum selesai.</p>
          <Button className="mt-4" onClick={() => navigate('/setup')}>Pengaturan awal</Button>
        </div>
      </div>
    )
  }

  const selected = MEMBER_SLOTS.find((m) => m.email === selectedEmail) ?? null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    try {
      await login(selected.email, password)
      navigate('/')
    } catch (error) {
      toast(translateAuthError(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-good">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Cashflow</h1>
            <p className="text-xs text-ink-muted">Pilih pengguna untuk masuk</p>
          </div>
        </div>
        {!selected ? (
          <div className="grid grid-cols-3 gap-3">
            {MEMBER_SLOTS.map((m) => (
              <button
                key={m.email}
                type="button"
                onClick={() => setSelectedEmail(m.email)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border-subtle bg-surface-card p-5 transition-colors hover:border-good"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: m.color }}
                >
                  {memberInitials(m.name)}
                </span>
                <span className="text-sm font-semibold text-ink">{m.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-2xl border border-border-subtle bg-surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: selected.color }}
                >
                  {memberInitials(selected.name)}
                </span>
                <h2 className="text-base font-semibold text-ink">{selected.name}</h2>
              </div>
              <button type="button" onClick={() => { setSelectedEmail(null); setPassword('') }} className="text-sm text-ink-muted hover:text-ink">
                Ganti
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-good"
            />
            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting ? 'Masuk…' : 'Masuk'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 1: Update `src/hooks/useAuth.tsx`** if needed (no signature change expected — verify `login` calls `ensureProfile`; it already does).
- [ ] **Step 2: Update `src/pages/LoginPage.test.tsx`** to the card-selector flow (select a card → fill password → expect `login` called with the member email).
- [ ] **Step 3: Run `npx vitest run src/pages/LoginPage.test.tsx src/hooks/useAuth.test.tsx`** — expect FAIL.
- [ ] **Step 4: Rewrite `src/pages/LoginPage.tsx` per above.**
- [ ] **Step 5: Run the tests** — expect PASS.
- [ ] **Step 6: Remove `/register` route** (Task 9 handles App.tsx; note here that RegisterPage becomes unused).
- [ ] **Step 7: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx
git commit -m "feat: card-based login for three members"
```

---

### Task 7: Read-only awareness helper

**Files:**
- Create: `src/hooks/useReadOnly.ts`
- Test: `src/hooks/useReadOnly.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `useMembers`.
- Produces:
  - `export function useCurrentMember(): Member | null` — the logged-in user's member row (matched by user id against members).
  - `export function useIsOwnData(userId: string | undefined): boolean` — true when `userId` equals the current member's id.
  - `export function useReadOnly(userId: string | undefined): boolean` — `!useIsOwnData(userId)`.

**`src/hooks/useReadOnly.ts`:**
```ts
import { useAuth } from './useAuth'
import { useMembers } from './useMembers'
import type { Member } from '../lib/members'

export function useCurrentMember(): Member | null {
  const { user } = useAuth()
  const { data: members } = useMembers()
  if (!user?.id || !members) return null
  return members.find((m) => m.id === user.id) ?? null
}

export function useIsOwnData(userId: string | undefined): boolean {
  const current = useCurrentMember()
  if (!userId) return false
  return current?.id === userId
}

export function useReadOnly(userId: string | undefined): boolean {
  return !useIsOwnData(userId)
}
```

- [ ] **Step 1: Write the failing tests** (mock `useAuth` and `useMembers` via the query client or component wrapper; assert `useIsOwnData` matches, `useReadOnly` true for others).
- [ ] **Step 2: Run the tests** — expect FAIL.
- [ ] **Step 3: Write `src/hooks/useReadOnly.ts`.**
- [ ] **Step 4: Run the tests** — expect PASS.
- [ ] **Step 5: Commit**

```bash
git add src/hooks/useReadOnly.ts src/hooks/useReadOnly.test.tsx
git commit -m "feat: read-only awareness hook on top of members"
```

---

### Task 8: Member filter component

**Files:**
- Create: `src/components/layout/MemberFilter.tsx`
- Test: `src/components/layout/MemberFilter.test.tsx`

**Interfaces:**
- Consumes: `useMembers`.
- Produces:
  - `export type OwnerFilter = 'all' | string`
  - `export function MemberFilter({ value, onChange }: { value: OwnerFilter; onChange: (v: OwnerFilter) => void })` — renders buttons "Semua" + one per member; calls `onChange` with `'all'` or the member id.

**`src/components/layout/MemberFilter.tsx`:**
```tsx
import { useMembers } from '../../hooks/useMembers'

export type OwnerFilter = 'all' | string

export function MemberFilter({ value, onChange }: { value: OwnerFilter; onChange: (v: OwnerFilter) => void }) {
  const { data: members } = useMembers()
  const list = members ?? []
  const options: OwnerFilter[] = ['all', ...list.map((m) => m.id)]
  const labels: Record<string, string> = { all: 'Semua' }
  for (const m of list) labels[m.id] = m.name

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            value === id ? 'bg-good text-white' : 'bg-surface-soft text-ink-muted hover:text-ink'
          }`}
        >
          {labels[id]}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 1: Write the failing test.**
- [ ] **Step 2: Run the test** — expect FAIL.
- [ ] **Step 3: Write `src/components/layout/MemberFilter.tsx`.**
- [ ] **Step 4: Run the test** — expect PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MemberFilter.tsx src/components/layout/MemberFilter.test.tsx
git commit -m "feat: member filter control"
```

---

### Task 9: Routing — setup route, drop register, guard setup

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx` (create or update)

**Interfaces:**
- Consumes: `SetupPage`, `LoginPage`, `ProtectedRoute`, `useIsSetupComplete`.
- Produces:
  - Route `/setup` → `SetupPage`.
  - Remove `/register` route.
  - A `SetupGate` in `App.tsx` that renders `SetupPage` at `/` if setup incomplete is not yet handled — simplest: keep `/login` behavior (LoginPage shows a "Pengaturan awal" button) and add `/setup`.

**Changes to `src/App.tsx`:** Add import `SetupPage`, add `<Route path="/setup" element={<SetupPage />} />`, remove the `/register` route and `RegisterPage` import.

- [ ] **Step 1: Modify `src/App.tsx`** — add `/setup`, remove `/register`.
- [ ] **Step 2: Delete `src/pages/RegisterPage.tsx`** (now unused) and `src/pages/RegisterPage.test.tsx`.
- [ ] **Step 3: Update/create `src/App.test.tsx`** to assert `/setup` renders and `/register` no longer renders.
- [ ] **Step 4: Run `npx vitest run src/App.test.tsx src/pages/LoginPage.test.tsx`** — expect PASS.
- [ ] **Step 5: Run `npm run lint`** — fix any unused-import warnings (e.g., removed `Link` in LoginPage).
- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add setup route and remove register"
```

---

### Task 10: Sidebar show current member + logout-consistency

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Test: `src/components/layout/Sidebar.test.tsx` (update)

**Interfaces:**
- Consumes: `useCurrentMember`, `useAuth`.
- Produces: Sidebar avatar/name reflects the current member name + color instead of raw profile/email.

**Changes:** In `Sidebar.tsx`, replace `displayName`/`initials` derivation with `useCurrentMember()`; use `member.name` and `member.color` for the avatar. Keep logout handler.

- [ ] **Step 1: Update `Sidebar.test.tsx`** to expect the member name/color.
- [ ] **Step 2: Run the test** — expect FAIL.
- [ ] **Step 3: Modify `Sidebar.tsx`.**
- [ ] **Step 4: Run the test** — expect PASS.
- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: sidebar reflects current member"
```

---

### Task 11: Accounts page read-only gating + member label

**Files:**
- Modify: `src/pages/AccountsPage.tsx`
- Test: `src/pages/AccountsPage.test.tsx` (update)

**Interfaces:**
- Consumes: `useReadOnly`, `MemberFilter`, `useMembers`, `getMemberById`.
- Produces:
  - A `MemberFilter` at the top; filtering by owner filters rendered accounts by `account.user_id`.
  - For each account card, show owner name/color when filter is `all` or when owner differs from current.
  - If the account's owner is not the current member (`useReadOnly(account.user_id)`), hide edit/archive/delete buttons and hide the "Tambah Akun"/"Transfer" buttons for that filter view.

**Key edits:**
1. Add imports for `MemberFilter`, `useReadOnly`, `useMembers`, `getMemberById`.
2. Add owner filter state: `const [owner, setOwner] = useState<OwnerFilter>('all')`.
3. Filter `list`/`archived` by `owner` when not `'all'` (compare `a.user_id`).
4. In `renderCard`, compute `const readOnly = useReadOnly(a.user_id)` (wrap `renderCard` in a component or compute via a helper since hooks can't be in a callback — restructure `renderCard` into an inner component `AccountCard`).
5. Show owner chip on each card when `owner === 'all'` or always.
6. Hide action buttons when readOnly.

**Note on hooks-in-loops:** `renderCard` currently is an inline function calling `openEdit` etc. Convert to a component `<AccountCard account={a} />` that calls `useReadOnly`.

- [ ] **Step 1: Read the existing `AccountsPage.test.tsx`.**
- [ ] **Step 2: Write/update the failing tests** (assert owner label shown when `all`, action buttons hidden for foreign accounts).
- [ ] **Step 3: Run the tests** — expect FAIL.
- [ ] **Step 4: Modify `AccountsPage.tsx`** (add filter, convert `renderCard` to `AccountCard` component, gate buttons, show owner chip).
- [ ] **Step 5: Run the tests** — expect PASS.
- [ ] **Step 6: Commit**

```bash
git add src/pages/AccountsPage.tsx src/pages/AccountsPage.test.tsx
git commit -m "feat: accounts page owner filter and read-only gating"
```

---

### Task 12: Dashboard — per-member cards + global + "Uang di" labels

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/DashboardPage.test.tsx` (update)
- Modify: `src/lib/balances.ts` (add helper) + `src/lib/balances.test.ts`

**Interfaces:**
- Consumes: `useMembers`, `getMemberById`, `computeAccountBalances`, `totalBalance`.
- Produces:
  - `export function totalBalanceByMember(balances, accounts, members): { memberId, name, color, total }[]` in `src/lib/balances.ts`.

**`src/lib/balances.ts` addition:**
```ts
export function totalBalanceByMember(
  balances: Record<string, number>,
  accounts: Account[],
  members: { id: string; name: string; color: string }[],
) {
  const totals = new Map<string, number>()
  for (const acc of accounts) {
    totals.set(acc.user_id, (totals.get(acc.user_id) ?? 0) + (balances[acc.id] ?? 0))
  }
  return members.map((m) => ({
    memberId: m.id,
    name: m.name,
    color: m.color,
    total: totals.get(m.id) ?? 0,
  }))
}
```

**`src/lib/balances.test.ts`:** add a test with two members and accounts/transactions, assert the per-member totals and that `totalBalanceByMember` sums to the grand total.

**Dashboard page changes:**
1. Fetch `useMembers()`.
2. Add a new stat row: one card per member titled `Uang di {name}` showing their total, plus keep a "Total Saldo" (global). If members not loaded, fall back to showing only global.
3. Add a `MemberFilter` that filters the "Transaksi Terbaru" and charts by owner (pass filtered transaction array).

- [ ] **Step 1: Add `totalBalanceByMember` to `src/lib/balances.ts` and the test; run `npx vitest run src/lib/balances.test.ts`** — expect PASS.
- [ ] **Step 2: Update `DashboardPage.test.tsx`** for the new "Uang di ..." cards and filter.
- [ ] **Step 3: Run the test** — expect FAIL.
- [ ] **Step 4: Modify `DashboardPage.tsx`.**
- [ ] **Step 5: Run the tests** — expect PASS.
- [ ] **Step 6: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/lib/balances.ts src/lib/balances.test.ts
git commit -m "feat: per-member and global dashboard"
```

---

### Task 13: Transactions page read-only gating + owner label

**Files:**
- Modify: `src/pages/TransactionsPage.tsx`
- Modify: `src/components/transaction/TransactionForm.tsx`
- Modify: `src/components/transaction/TransactionRow.tsx` (or wherever row actions live)
- Test: update `src/pages/TransactionsPage.test.tsx`, `src/components/transaction/TransactionRow.test.tsx`

**Interfaces:**
- Consumes: `MemberFilter`, `useReadOnly`, `getMemberById`.
- Produces: owner filter; owner chip per row; hide create/edit/delete controls for foreign transactions.

**Key edits in `TransactionsPage.tsx`:**
1. Add `MemberFilter`; filter rows by `t.user_id` when `owner !== 'all'`.
2. When `owner === 'all'`, show owner chip on each row.
3. Gate "Tambah Transaksi" button and row edit/delete actions via `useReadOnly(t.user_id)` — hide them for foreign rows.
4. Pass a `readOnly` prop to `TransactionForm` so it disables when creating for a foreign context (creating is always for self, so `readOnly` false there).

- [ ] **Step 1: Read `src/pages/TransactionsPage.tsx` and `src/components/transaction/TransactionRow.tsx`** to locate the action buttons.
- [ ] **Step 2: Write/update failing tests** (owner label, hidden actions for foreign rows).
- [ ] **Step 3: Run tests** — expect FAIL.
- [ ] **Step 4: Modify the files.**
- [ ] **Step 5: Run tests** — expect PASS.
- [ ] **Step 6: Commit**

```bash
git add src/pages/TransactionsPage.tsx src/components/transaction/TransactionRow.tsx src/components/transaction/TransactionForm.tsx
git commit -m "feat: transactions owner filter and read-only gating"
```

---

### Task 14: Categories & Recurring read-only gating + owner label

**Files:**
- Modify: `src/pages/CategoriesPage.tsx`
- Modify: `src/pages/RecurringPage.tsx`
- Test: update `src/pages/CategoriesPage.test.tsx`, `src/pages/RecurringPage.test.tsx`

**Interfaces:**
- Consumes: `MemberFilter`, `useReadOnly`, `getMemberById`.
- Produces: owner filter and owner chips; hide create/edit/delete for foreign items.

**Apply the same pattern as Task 11/13:**
- Add `MemberFilter`, filter lists by `user_id` when not `all`.
- Show owner chip on each item (at least when `owner === 'all'`).
- Convert inline renderers to components that call `useReadOnly(item.user_id)`; hide actions when read-only; hide "Tambah" for filtered foreign views.

- [ ] **Step 1: Read both pages and their tests.**
- [ ] **Step 2: Write/update failing tests.**
- [ ] **Step 3: Run tests** — expect FAIL.
- [ ] **Step 4: Modify both pages.**
- [ ] **Step 5: Run tests** — expect PASS.
- [ ] **Step 6: Commit**

```bash
git add src/pages/CategoriesPage.tsx src/pages/RecurringPage.tsx
git commit -m "feat: categories and recurring owner filter and read-only gating"
```

---

### Task 15: Reports page owner filter

**Files:**
- Modify: `src/pages/ReportsPage.tsx`
- Test: update `src/pages/ReportsPage.test.tsx`

**Interfaces:**
- Consumes: `MemberFilter`, `useTransactions`, `useAccounts`, `useCategories`.
- Produces: member filter applied to the underlying transaction/account/category arrays used by the report computations.

- [ ] **Step 1: Read `src/pages/ReportsPage.tsx` and its test.**
- [ ] **Step 2: Add `MemberFilter`** and filter the data arrays by owner before passing to report builders.
- [ ] **Step 3: Write/update the test** (choose a member, assert report reflects only that member's data).
- [ ] **Step 4: Run tests** — expect PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/ReportsPage.tsx src/pages/ReportsPage.test.tsx
git commit -m "feat: reports owner filter"
```

---

### Task 16: Settings — remove profile/register ties; backup includes owner labels

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Test: update `src/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `useCurrentMember`, `useProfile`.
- Produces:
  - Settings shows current member name/color (read-only identity) instead of an editable "full name" that duplicates register flow.
  - Backup/export uses member-aware labels (data rows already carry `user_id`; CSV export includes an owner column resolved via `useMembers`).
- Keep currency editing as-is (profiles table still stores currency per user).

- [ ] **Step 1: Read `SettingsPage.tsx` and `src/lib/csv.ts`.**
- [ ] **Step 2: Update Settings to show current member identity read-only; keep currency editable.**
- [ ] **Step 3: Add an owner column to CSV export** resolved via `getMemberById`.
- [ ] **Step 4: Update tests and run** — expect PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx src/lib/csv.ts
git commit -m "feat: settings identity and owner-aware export"
```

---

### Task 17: Final verification

**Files:**
- None (verification only)

**Steps:**
- [ ] **Step 1: Run the full test suite** `npm test` — all pass.
- [ ] **Step 2: Run lint** `npm run lint` — no errors.
- [ ] **Step 3: Run build** `npm run build` — succeeds.
- [ ] **Step 4: Manual smoke test** against local Supabase: run `/setup`, then pick a card and log in, confirm read-only for other members, confirm per-member + global dashboard.
- [ ] **Step 5: Commit any residual cleanup** (none expected).

```bash
git add -A
git commit -m "chore: final verification pass"
```
