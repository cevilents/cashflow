# Sumber Dana Shared + Top-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make funding sources (`type='funding'` accounts) shared across all members (any member can manage any funding source), and add top-up / saldo-adjustment with dated history via a new `funding_transactions` table.

**Architecture:** Funding accounts stay in `accounts` with `type='funding'`, but get a new permissive RLS policy so any authenticated user can create/edit/delete them. A new `funding_transactions` table records dated, signed balance adjustments (positive = top-up, negative = withdrawal). `computeAccountBalances` gains an optional `fundingTransactions` param so a funding source's balance = opening balance + adjustments − outgoing transfers. The FundingSourcesPage unlocks action buttons for all members and adds a "Penyesuaian/Top Up" modal plus a short history view.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, TanStack Query, Supabase (Postgres + RLS), Vitest, React Testing Library, lucide-react.

## Global Constraints

- All UI copy in Indonesian.
- No new dependencies. No `any`; strict TypeScript (`npm run build` runs `tsc -b`).
- Only `type='funding'` accounts become shared; spendable accounts / categories / transactions / recurring remain per-user write-own + read-all (RLS unchanged for them).
- Funding top-ups must NOT appear as income in the regular reports / Dashboard (those stay based on `transactions` only).
- `computeAccountBalances` signature is extended with an optional param — existing callers must keep working unchanged.
- Hard-delete of a funding source is blocked when it has any `transactions` OR any `funding_transactions` (archive instead).
- Reuse existing UI primitives (Modal, Button, Input, Select, ConfirmDialog, Toast) and existing modal patterns (`FundingTransferModal`).
- Verify with `npm test`, `npm run lint`, `npm run build`.

---

### Task 1: Migration (RLS for funding accounts + `funding_transactions` table) + TS types

**Files:**
- Create: `supabase/migrations/20260821010000_funding_shared_topup.sql`
- Modify: `src/types/database.ts`
- Test: `src/lib/balances.test.ts` (add new test in this task or Task 2 — see Task 2)

**Interfaces:**
- Consumes: nothing new.
- Produces: `FundingTransaction` TS interface; DB tables/policies as described.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260821010000_funding_shared_topup.sql`:

```sql
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
```

- [ ] **Step 2: Add the TS type**

In `src/types/database.ts`, append:

```ts
export interface FundingTransaction {
  id: string
  account_id: string
  amount: number
  date: string
  note: string
  created_at: string
}
```

- [ ] **Step 3: Add a balance test for funding adjustments**

Append to `src/lib/balances.test.ts`:

```ts
import { computeAccountBalances } from './balances'
import type { FundingTransaction } from '../types/database'

const ft = (partial: Partial<FundingTransaction>): FundingTransaction => ({
  id: partial.id ?? 'f',
  account_id: partial.account_id ?? 'a',
  amount: partial.amount ?? 0,
  date: partial.date ?? '2026-08-01',
  note: partial.note ?? '',
  created_at: '',
})

// inside a describe block (e.g. a new describe('computeAccountBalances + fundingTransactions'))
it('adds funding top-ups and subtracts withdrawals on top of opening balance', () => {
  const accounts = [
    { ...acc('fund-a', 1000), type: 'funding' as const },
  ]
  const txs: Transaction[] = []
  const funding = [
    ft({ account_id: 'fund-a', amount: 500 }),
    ft({ account_id: 'fund-a', amount: -200 }),
  ]
  const r = computeAccountBalances(accounts, txs, funding)
  expect(r['fund-a']).toBe(1300)
})

it('leaves balances unchanged when no fundingTransactions is passed', () => {
  const accounts = [{ ...acc('fund-a', 1000), type: 'funding' as const }]
  const r = computeAccountBalances(accounts, [])
  expect(r['fund-a']).toBe(1000)
})
```

Note: the `acc` and `tx` helpers already exist in the file. If `Transaction` is not imported in `balances.test.ts` at the top, add `import type { Transaction, FundingTransaction } from '../types/database'` (adjust the existing import line).

- [ ] **Step 4: Run the balance tests and confirm the new ones fail**

Run: `npx vitest run src/lib/balances.test.ts`
Expected: FAIL on the new `fundingTransactions` cases (parameter not handled yet → balances do not reflect top-ups). The `acc`/`tx` helpers must compile (they exist).

- [ ] **Step 5: Commit the migration + type + failing test**

```bash
git add supabase/migrations/20260821010000_funding_shared_topup.sql src/types/database.ts src/lib/balances.test.ts
git commit -m "feat: funding shared RLS, funding_transactions table, type, balance test"
```

> NOTE: `computeAccountBalances` implementation is updated in Task 2. The failing test committed here is RED by design (TDD). It will pass after Task 2.

---

### Task 2: `useFundingTransactions` hook + extend `computeAccountBalances`

**Files:**
- Modify: `src/lib/balances.ts`
- Modify: `src/lib/balances.test.ts` (the test from Task 1)
- Create: `src/hooks/useFundingTransactions.ts`
- Test: `src/hooks/useFundingTransactions.test.tsx`

**Interfaces:**
- Consumes: `FundingTransaction` from `src/types/database`.
- Produces:
  - `computeAccountBalances(accounts, transactions, fundingTransactions?: FundingTransaction[])`.
  - `useFundingTransactions(): { data: FundingTransaction[] | undefined, ... }` (query key `['funding-transactions', user?.id]`).
  - `useCreateFundingTransaction()` mutation (query key invalidation `['funding-transactions']` + `['accounts']`).
  - `CreateFundingTransactionInput = Pick<FundingTransaction, 'account_id' | 'amount' | 'date' | 'note'>`.

- [ ] **Step 1: Implement `computeAccountBalances` extension**

In `src/lib/balances.ts`, update the import and signature, and add the funding-adjustment loop before the transaction loop:

```ts
import type { Account, Transaction, FundingTransaction } from '../types/database'
import { isFundingAccount } from './accounts'

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
  fundingTransactions?: FundingTransaction[],
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const acc of accounts) balances[acc.id] = Number(acc.opening_balance) || 0
  for (const f of fundingTransactions ?? []) {
    balances[f.account_id] = (balances[f.account_id] ?? 0) + Number(f.amount)
  }
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
```

- [ ] **Step 2: Create `src/hooks/useFundingTransactions.ts`**

Follow the `useAccounts.ts` pattern exactly:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { FundingTransaction } from '../types/database'

export type CreateFundingTransactionInput = Pick<FundingTransaction, 'account_id' | 'amount' | 'date' | 'note'>

const selectFundingTransactions = async (): Promise<FundingTransaction[]> => {
  const { data, error } = await supabase
    .from('funding_transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as FundingTransaction[]
}

export function useFundingTransactions() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['funding-transactions', user?.id],
    queryFn: selectFundingTransactions,
    enabled: !!user?.id,
  })
}

export function useCreateFundingTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateFundingTransactionInput) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('funding_transactions').insert(input)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funding-transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
```

Note: `funding_transactions` has no `user_id` column; the RLS policy allows any authenticated role to write, so no `user_id` is injected.

- [ ] **Step 3: Create `src/hooks/useFundingTransactions.test.tsx`**

Follow the `useAccounts.test.tsx` mock pattern (`vi.mock` of `../lib/supabase` and `../hooks/useAuth`, `makeQueryChain`, `renderQueryHook`). Write:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFundingTransactions, useCreateFundingTransaction } from './useFundingTransactions'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }))

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'funding_transactions') {
        chain.order.mockResolvedValue({ data: [], error: null })
        chain.insert.mockResolvedValue({ error: null })
      }
    }
    return mocks.chains[table]
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
}

describe('useFundingTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chains = {}
    installMock()
  })

  it('reads funding_transactions and passes create input to insert', async () => {
    function Hook() {
      const { data } = useFundingTransactions()
      const create = useCreateFundingTransaction()
      return { data, create }
    }
    // render via renderHook with the wrapper
    const { result } = renderHook(() => Hook(), { wrapper })
    // wait for data
    await waitFor(() => expect(mocks.from('funding_transactions').order).toHaveBeenCalled())
    await act(async () => {
      await result.current.create.mutateAsync({ account_id: 'fund-1', amount: 500, date: '2026-08-21', note: 'top up' })
    })
    const chain = mocks.chains['funding_transactions']
    expect(chain?.insert).toHaveBeenCalledWith({ account_id: 'fund-1', amount: 500, date: '2026-08-21', note: 'top up' })
  })
})
```

> NOTE: `renderHook` must be imported from `@testing-library/react` (the file test/queryTestUtils exports `renderQueryHook`; you may use `renderQueryHook` from `../test/queryTestUtils` instead if cleaner). Match the existing test conventions in `src/hooks/useAccounts.test.tsx`. Adapt the render approach to whatever `useAccounts.test.tsx` actually uses so the test compiles and the create mutation asserts `insert` with the exact input.

- [ ] **Step 4: Run the hook test and the balance tests**

Run: `npx vitest run src/hooks/useFundingTransactions.test.tsx src/lib/balances.test.ts`
Expected: PASS (hook test passes; the Task-1 balance tests now pass after the `computeAccountBalances` extension).

- [ ] **Step 5: Run full lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/balances.ts src/lib/balances.test.ts src/hooks/useFundingTransactions.ts src/hooks/useFundingTransactions.test.tsx
git commit -m "feat: funding top-up balance computation and hook"
```

---

### Task 3: `FundingAdjustmentModal`

**Files:**
- Create: `src/components/account/FundingAdjustmentModal.tsx`
- Test: `src/components/account/FundingAdjustmentModal.test.tsx`

**Interfaces:**
- Consumes: `Account` (type), `useCreateFundingTransaction` from `../../hooks/useFundingTransactions`, `useToast` from `../ui/Toast`, `Modal`/`Button`/`Input`/`Select` from ui, `parseAmountInput`/`formatRupiah` from `../../lib/format`, `todayISO` from `../../lib/dates`.
- Produces: `<FundingAdjustmentModal open onClose source={Account | null} />` that records a signed `funding_transactions` row (positive for Top Up, negative for Penarikan).

- [ ] **Step 1: Write failing component test**

Create `src/components/account/FundingAdjustmentModal.test.tsx` following the `TransferModal.test.tsx` mock pattern (`vi.mock` of `../../lib/supabase` and `../../hooks/useAuth`, `makeQueryChain`). Tests:

```tsx
it('submits a top-up with positive amount and default today date', async () => {
  renderModal()
  await waitForReady() // wait for account options
  fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '250000' } })
  await act(async () => { fireEvent.submit(form()) })
  const ft = mocks.chains['funding_transactions']
  expect(ft?.insert).toHaveBeenCalledWith(expect.objectContaining({
    account_id: 'fund-1',
    amount: 250000,
    date: todayISO(),
    note: '',
  }))
  expect(await screen.findByText('Penyesuaian disimpan')).toBeInTheDocument()
  expect(onClose).toHaveBeenCalled()
})

it('submits a withdrawal with negative amount', async () => {
  renderModal()
  await waitForReady()
  fireEvent.change(screen.getByLabelText('Jenis'), { target: { value: 'withdraw' } })
  fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '120000' } })
  await act(async () => { fireEvent.submit(form()) })
  const ft = mocks.chains['funding_transactions']
  expect(ft?.insert).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'fund-1', amount: -120000 }))
})

it('requires a valid amount', async () => {
  renderModal()
  await waitForReady()
  fireEvent.submit(form())
  expect(await screen.findByText('Masukkan jumlah yang valid')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm it fails (module missing)**

Run: `npx vitest run src/components/account/FundingAdjustmentModal.test.tsx`
Expected: FAIL — cannot find module `./FundingAdjustmentModal`.

- [ ] **Step 3: Create `src/components/account/FundingAdjustmentModal.tsx`**

Following the `FundingTransferModal.tsx` patterns:

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { useToast } from '../ui/Toast'
import { useCreateFundingTransaction } from '../../hooks/useFundingTransactions'
import { parseAmountInput, formatRupiah } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import type { Account } from '../../types/database'

type AdjustmentKind = 'topup' | 'withdraw'

export function FundingAdjustmentModal({
  open,
  onClose,
  source,
}: {
  open: boolean
  onClose: () => void
  source: Account | null
}) {
  const createAdj = useCreateFundingTransaction()
  const { toast } = useToast()
  const [kind, setKind] = useState<AdjustmentKind>('topup')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind('topup')
    setAmountRaw('')
    setDate(todayISO())
    setNote('')
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!source) return
    const amount = parseAmountInput(amountRaw)
    if (amount === null) {
      toast('Masukkan jumlah yang valid', 'error')
      return
    }
    const signed = kind === 'withdraw' ? -amount : amount
    setSaving(true)
    try {
      await createAdj.mutateAsync({ account_id: source.id, amount: signed, date, note })
      toast('Penyesuaian disimpan')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal simpan penyesuaian', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Penyesuaian Saldo">
      {source ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-surface-soft px-4 py-3">
            <span className="text-xs font-medium text-ink-muted">Sumber dana</span>
            <p className="text-sm font-semibold text-ink">{source.name}</p>
          </div>
          <Select label="Jenis" value={kind} onChange={(e) => setKind(e.target.value as AdjustmentKind)}>
            <option value="topup">Top Up (tambah saldo)</option>
            <option value="withdraw">Penarikan (kurang saldo)</option>
          </Select>
          <div className="relative">
            <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
            {parseAmountInput(amountRaw) !== null && (
              <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">= {formatRupiah(parseAmountInput(amountRaw)!)}</span>
            )}
          </div>
          <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: top up bulanan" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
```

> If the component uses `useMemo` it must be imported; if not used, remove it from the import to avoid an unused-import lint error. Only import what is used.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/account/FundingAdjustmentModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/account/FundingAdjustmentModal.tsx src/components/account/FundingAdjustmentModal.test.tsx
git commit -m "feat: funding balance adjustment modal"
```

---

### Task 4: Update `FundingSourcesPage` (shared access + top-up + history + delete rule)

**Files:**
- Modify: `src/pages/FundingSourcesPage.tsx`
- Test: `src/pages/FundingSourcesPage.test.tsx`

**Interfaces:**
- Consumes: `useFundingTransactions` from `../hooks/useFundingTransactions`, `FundingAdjustmentModal` from `../components/account/FundingAdjustmentModal`, `isFundingAccount` from `../lib/accounts`, `computeAccountBalances` (already imported).
- Produces: shared-edit FundingSourcesPage with per-source adjustment + history, and extended delete rule.

- [ ] **Step 1: Update the tests for shared access + top-up + history**

In `src/pages/FundingSourcesPage.test.tsx`:
- Change the existing read-only test ("hides action buttons for funding sources owned by another member") so it now asserts the OPPOSITE — a foreign member's funding source still SHOWS all action buttons (shared). Update/rename it.
- Add funding_transactions to the mock (`mocks.from('funding_transactions')` returning `[]`), and add tests:
  - "opens the adjustment modal from a source card and submits a top-up"
  - "shows recent funding adjustments as history on the card"

Update `installMock()` in the test to handle the `funding_transactions` table (order mock returns the funding data array; insert mock resolves). Add a `mocks.fundingTransactions` array and return it for `funding_transactions`.

Example for the shared test (replacing the old read-only test):

```tsx
it('shows action buttons for every funding source regardless of owner', async () => {
  mocks.members = [ bima, aska ] // aska = user-2
  mocks.accounts = [
    { id: 'own-fund', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 100000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    { id: 'foreign-fund', user_id: 'user-2', name: 'LYNK', type: 'funding', opening_balance: 50000, color: '#ccc', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  renderPage()
  await screen.findByText('IB HFM')
  const foreignCard = screen.getByText('LYNK').closest('div.rounded-2xl') as HTMLElement
  expect(within(foreignCard).getByRole('button', { name: 'Transfer' })).toBeInTheDocument()
  expect(within(foreignCard).getByRole('button', { name: 'Ubah' })).toBeInTheDocument()
  expect(within(foreignCard).getByRole('button', { name: 'Arsipkan' })).toBeInTheDocument()
  expect(within(foreignCard).getByRole('button', { name: 'Hapus' })).toBeInTheDocument()
})
```

Add a test for the adjustment modal and history that fits the file's conventions.

- [ ] **Step 2: Run FundingSourcesPage tests and confirm the updated/new ones reflect the new behavior**

Run: `npx vitest run src/pages/FundingSourcesPage.test.tsx`
Expected: the updated shared test passes only after Step 3's implementation; the adjustment/history tests fail until the modal + history render is added.

- [ ] **Step 3: Modify `src/pages/FundingSourcesPage.tsx`**

1. Imports — add:
```ts
import { useFundingTransactions, useCreateFundingTransaction } from '../hooks/useFundingTransactions'
import { FundingAdjustmentModal } from '../components/account/FundingAdjustmentModal'
```
Add an icon for the adjustment button to the lucide import, e.g. `PlusCircle`.

2. In the component, add hooks and state:
```ts
const { data: fundingTransactions } = useFundingTransactions()
const [adjustSource, setAdjustSource] = useState<Account | null>(null)
```

3. Compute balances including funding adjustments:
```ts
const balances = useMemo(
  () => computeAccountBalances(accounts ?? [], transactions ?? [], fundingTransactions ?? []),
  [accounts, transactions, fundingTransactions],
)
```

4. Build a per-account history map (recent adjustments) for display. Add:
```ts
const historyByAccount = useMemo(() => {
  const map: Record<string, FundingTransaction[]> = {}
  for (const f of fundingTransactions ?? []) {
    ;(map[f.account_id] ||= []).push(f)
  }
  return map
}, [fundingTransactions])
```
(Import `FundingTransaction` type.)

5. `SourceCard` — remove the `useReadOnly` gate so action buttons always show:
- Remove `const readOnly = useReadOnly(account.user_id)` and the `{!readOnly && (...)}` wrapper (render the buttons unconditionally).
- Add a "Penyesuaian" button (aria-label="Penyesuaian", `PlusCircle` icon) before the Transfer button, wired to a new `onAdjust` prop. Extend `SourceCardProps` with `onAdjust: (a: Account) => void` and pass `history: FundingTransaction[]`.
- Render a short history block inside the card (e.g. the last 3 adjustments: date + signed `formatRupiah`), e.g.:
```tsx
{history.length > 0 && (
  <ul className="mt-3 space-y-1 border-t border-border-subtle pt-3 text-xs text-ink-muted">
    {history.slice(0, 3).map((h) => (
      <li key={h.id} className="flex justify-between">
        <span>{h.date}</span>
        <span className="tabular">{h.amount >= 0 ? '+' : ''}{formatRupiah(h.amount)}</span>
      </li>
    ))}
  </ul>
)}
```

6. `SourceCard` usages — pass `onAdjust={setAdjustSource}` and `history={historyByAccount[a.id] ?? []}`.

7. Remove the `canManage` gate on the "Tambah Sumber Dana" button (always show).

8. Update `confirmDelete`: also block when the source has funding adjustments:
```ts
const hasAdjustments = (fundingTransactions ?? []).some((f) => f.account_id === deleting.id)
if ((txCountByAccount[deleting.id] ?? 0) > 0 || hasAdjustments) {
  toast('Sumber dana ini punya aktivitas — arsipkan saja, tidak bisa dihapus', 'error')
  setDeleting(null)
  return
}
```

9. Render the new modal:
```tsx
<FundingAdjustmentModal open={adjustSource !== null} onClose={() => setAdjustSource(null)} source={adjustSource} />
```

- [ ] **Step 4: Run the FundingSourcesPage tests and confirm they pass**

Run: `npx vitest run src/pages/FundingSourcesPage.test.tsx`
Expected: PASS (updated shared test + new adjustment/history tests).

- [ ] **Step 5: Run full suite + lint + build**

Run: `npm test; npm run lint; npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/FundingSourcesPage.tsx src/pages/FundingSourcesPage.test.tsx
git commit -m "feat: shared funding page with top-up and history"
```

---

### Task 5: Final verification + apply migration

**Files:**
- Apply `supabase/migrations/20260821010000_funding_shared_topup.sql` to the linked production project (needs user consent; the plan's controller confirms before applying).

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all green (~325+ tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (2 pre-existing warnings).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Migration apply**

After all code is green and reviewed, apply the migration to the linked project:
Run: `supabase migration list --linked` (confirm `20260821010000` pending), then with explicit user consent: `supabase db push --linked` (or `supabase db push`) and verify it records locally+remote. Then `supabase db query --linked` to confirm the `funding_transactions` table exists and the `accounts write all funding` policy is present.

- [ ] **Step 5: Commit / done**

No code changes expected beyond the reviewed/merged commits. Report completion.
