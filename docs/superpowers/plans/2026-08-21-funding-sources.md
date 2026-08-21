# Fitur Sumber Dana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add funding sources (sumber dana — e.g. IB Exness, IB HFM, LYNK.ID) as a new account type whose balances can be transferred into regular bank/ewallet/cash accounts.

**Architecture:** Funding sources are modeled as `accounts` rows with `type='funding'`. No new tables. Balance math and the existing transfer transaction mechanism are reused unchanged. A new "Transfer dari Sumber Dana" modal records a `type='transfer'` transaction (source → bank). Existing account pickers and the existing transfer modal are restricted to non-funding accounts so funding sources stay visually and semantically separate.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, TanStack Query, Supabase (Postgres + RLS), Vitest, React Testing Library.

## Global Constraints

- All UI copy in Indonesian (matches existing app).
- No new dependencies.
- No `any`; strict TypeScript (`npm run build` runs `tsc -b`).
- RLS / multi-user write-own-read-all model is unchanged.
- `AccountType` union gains `'funding'`; `Account` interface columns unchanged.
- `totalBalance` (global) must only sum non-funding accounts; funding sources get their own subtotal section.
- Existing tests must keep passing; new behaviour is covered by new tests.
- Commands: verify with `npm test`, `npm run lint`, `npm run build`.

---

### Task 1: Add `funding` account type (database migration + types + labels + helpers)

**Files:**
- Create: `supabase/migrations/20260821000000_funding_account_type.sql`
- Modify: `src/types/database.ts`
- Modify: `src/lib/labels.ts`
- Create: `src/lib/accounts.ts`
- Test: `src/lib/accounts.test.ts`

**Interfaces:**
- Produces: `AccountType` includes `'funding'`.
- Produces: `export function isFundingAccount(a: Pick<Account,'type'>): boolean` and `export function isSpendableAccount(a: Pick<Account,'type'>): boolean` in `src/lib/accounts.ts`.
- Consumes: `Account` from `src/types/database`.

- [ ] **Step 1: Write failing tests for the pure helpers**

Create `src/lib/accounts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isFundingAccount, isSpendableAccount } from './accounts'
import type { Account } from '../types/database'

const account = (type: Account['type']): Account => ({
  id: 'a', user_id: 'u', name: 'a', type, opening_balance: 0,
  color: '#000', is_archived: false, created_at: '',
})

describe('account type helpers', () => {
  it('isFundingAccount is true only for funding type', () => {
    expect(isFundingAccount(account('funding'))).toBe(true)
    expect(isFundingAccount(account('bank'))).toBe(false)
    expect(isFundingAccount(account('cash'))).toBe(false)
    expect(isFundingAccount(account('ewallet'))).toBe(false)
    expect(isFundingAccount(account('other'))).toBe(false)
  })

  it('isSpendableAccount is true for non-funding types', () => {
    expect(isSpendableAccount(account('bank'))).toBe(true)
    expect(isSpendableAccount(account('cash'))).toBe(true)
    expect(isSpendableAccount(account('ewallet'))).toBe(true)
    expect(isSpendableAccount(account('other'))).toBe(true)
    expect(isSpendableAccount(account('funding'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the new test and confirm it fails (module missing)**

Run: `npx vitest run src/lib/accounts.test.ts`
Expected: FAIL with cannot find module `./accounts`.

- [ ] **Step 3: Update `src/types/database.ts`**

Change line 1:

```ts
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other' | 'funding'
```

- [ ] **Step 4: Update `src/lib/labels.ts`**

```ts
export const accountTypeLabels: Record<AccountType, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-wallet',
  other: 'Lainnya',
  funding: 'Sumber Dana',
}
```

Note: `AccountForm.tsx` renders its Tipe dropdown by mapping `Object.entries(accountTypeLabels)` (line 84), so adding `funding` to `accountTypeLabels` automatically exposes the "Sumber Dana" option in the account create/edit form. No separate `AccountForm` code change is required for the spec's "Sumber Dana" type option. (Spec Bagian 3 requirement.)

- [ ] **Step 5: Create `src/lib/accounts.ts`**

```ts
import type { Account } from '../types/database'

export function isFundingAccount(a: Pick<Account, 'type'>): boolean {
  return a.type === 'funding'
}

export function isSpendableAccount(a: Pick<Account, 'type'>): boolean {
  return a.type !== 'funding'
}
```

- [ ] **Step 6: Run the new test and confirm it passes**

Run: `npx vitest run src/lib/accounts.test.ts`
Expected: PASS.

- [ ] **Step 7: Create the migration file**

Create `supabase/migrations/20260821000000_funding_account_type.sql`:

```sql
alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('cash','bank','ewallet','other','funding'));
```

- [ ] **Step 8: Run full test + lint + build**

Run: `npm test; npm run lint; npm run build`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260821000000_funding_account_type.sql src/types/database.ts src/lib/labels.ts src/lib/accounts.ts src/lib/accounts.test.ts
git commit -m "feat: add funding account type with helpers"
```

---

### Task 2: Restrict account pickers to non-funding accounts

**Files:**
- Modify: `src/components/transaction/TransactionForm.tsx`
- Modify: `src/components/account/TransferModal.tsx`
- Test: `src/components/transaction/TransactionForm.test.tsx` (add cases)
- Test: `src/components/account/TransferModal.test.tsx` (add case)

**Interfaces:**
- Consumes: `isSpendableAccount` from `src/lib/accounts.ts`.
- Produces: Dropdowns in `TransactionForm` (Akun + Transfer ke) and `TransferModal` (Dari akun + Ke akun) only list accounts where `isSpendableAccount` is true.

- [ ] **Step 1: Modify `TransactionForm.tsx`**

In `TransactionForm.tsx`, add import and filter the account list. Add near other imports:

```ts
import { isSpendableAccount } from '../../lib/accounts'
```

Change line 49 `activeAccounts` so it only keeps spendable accounts:

```ts
const activeAccounts = useMemo(
  () => (accounts ?? []).filter((a) => !a.is_archived && isSpendableAccount(a)),
  [accounts],
)
```

- [ ] **Step 2: Modify `TransferModal.tsx`**

Add import:

```ts
import { isSpendableAccount } from '../../lib/accounts'
```

Change line 24 `active` so it only keeps spendable accounts:

```ts
const active = useMemo(
  () => (accounts ?? []).filter((a) => !a.is_archived && isSpendableAccount(a)),
  [accounts],
)
```

- [ ] **Step 3: Add a test to `TransactionForm.test.tsx` proving funding accounts are excluded**

Open `src/components/transaction/TransactionForm.test.tsx`, locate the harness that feeds `useAccounts` via supabase mock (same pattern as `TransferModal.test.tsx`). Add a funding account to the mock accounts array and assert its name never appears in the "Akun" or "Transfer ke" dropdowns. Example (match the file's existing mock shape):

```tsx
it('does not list funding accounts in account dropdowns', async () => {
  // The mock accounts must include a row like:
  // { id: 'acc-fund', user_id: 'user-1', name: 'IB HFM', type: 'funding', ... }
  // Then render the form, choose type 'transfer', and assert:
  //   within(akunSelect).queryByText('IB HFM') is null
  //   within(transferToSelect).queryByText('IB HFM') is null
})
```

Implement the actual assertion against the file's real mock structure (mirror the existing `TransferModal` expectations: `Array.from(select.options).map(o => o.value)`).

- [ ] **Step 4: Add a test to `TransferModal.test.tsx` proving funding accounts are excluded**

Add a funding account to the `accounts` mock array in `TransferModal.test.tsx` (e.g. `{ id: 'acc-fund', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 0, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' }`), then add:

```tsx
it('excludes funding accounts from both dropdowns', async () => {
  const { onClose } = renderModal()
  await waitForReady()
  const fromSelect = screen.getByLabelText('Dari akun') as HTMLSelectElement
  const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
  const fromOptions = Array.from(fromSelect.options).map((o) => o.value)
  const toOptions = Array.from(toSelect.options).map((o) => o.value)
  expect(fromOptions).not.toContain('acc-fund')
  expect(toOptions).not.toContain('acc-fund')
})
```

Note: adding a funding account changes the default `from` selection assert in `waitForReady` (line 66 expects `acc-1`). Because the funding account is excluded from `active`, `active[0]` stays `acc-1` — so `waitForReady` remains valid as long as the funding row is appended after `acc-1`. Keep all existing accounts and append the funding row last.

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/components/transaction src/components/account`
Expected: PASS (new + existing).

- [ ] **Step 6: Run full lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/transaction/TransactionForm.tsx src/components/account/TransferModal.tsx src/components/transaction/TransactionForm.test.tsx src/components/account/TransferModal.test.tsx
git commit -m "feat: keep funding sources out of account pickers"
```

---

### Task 3: Restrict global total balance to non-funding accounts

**Files:**
- Modify: `src/lib/balances.ts`
- Test: `src/lib/balances.test.ts`

**Interfaces:**
- Consumes: `isFundingAccount` and `isSpendableAccount` from `src/lib/accounts.ts`.
- Produces: A new exported helper `spendableTotalBalance(balances, accounts): number` and a counter helper `totalFundingBalance(balances, accounts): number`.

- [ ] **Step 1: Write failing tests**

Append to `src/lib/balances.test.ts`:

```ts
import { computeAccountBalances, totalBalance, totalBalanceByMember, spendableTotalBalance, totalFundingBalance } from './balances'
import { isFundingAccount } from './accounts'

describe('spendableTotalBalance', () => {
  it('excludes funding accounts from the global total', () => {
    const accounts = [
      { ...acc('cash-a', 100), type: 'cash' as const },
      { ...acc('fund-a', 500), type: 'funding' as const },
    ]
    const balances = computeAccountBalances(accounts, [])
    expect(spendableTotalBalance(balances, accounts)).toBe(100)
    expect(totalFundingBalance(balances, accounts)).toBe(500)
    expect(totalBalance(balances)).toBe(600)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/balances.test.ts`
Expected: FAIL — `spendableTotalBalance` is not exported.

- [ ] **Step 3: Implement in `src/lib/balances.ts`**

Add import at top:

```ts
import { isFundingAccount } from './accounts'
```

Add exports after `totalBalance`:

```ts
export function spendableTotalBalance(balances: Record<string, number>, accounts: Account[]): number {
  return accounts
    .filter((a) => !isFundingAccount(a))
    .reduce((sum, a) => sum + (balances[a.id] ?? 0), 0)
}

export function totalFundingBalance(balances: Record<string, number>, accounts: Account[]): number {
  return accounts
    .filter((a) => isFundingAccount(a))
    .reduce((sum, a) => sum + (balances[a.id] ?? 0), 0)
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run src/lib/balances.test.ts`
Expected: PASS.

- [ ] **Step 5: Run lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/balances.ts src/lib/balances.test.ts
git commit -m "feat: exclude funding sources from global total balance"
```

---

### Task 4: Build "Transfer dari Sumber Dana" modal

**Files:**
- Create: `src/components/account/FundingTransferModal.tsx`
- Test: `src/components/account/FundingTransferModal.test.tsx`

**Interfaces:**
- Consumes: `Account` (type), `useAccounts` from `src/hooks/useAccounts`, `useCreateTransaction` from `src/hooks/useTransactions`, `useToast` from `../ui/Toast`, `Modal`/`Button`/`Input`/`Select` from ui, `parseAmountInput`/`formatRupiah` from `../../lib/format`, `todayISO` from `../../lib/dates`, `isFundingAccount`/`isSpendableAccount` from `../../lib/accounts`.
- Produces: `<FundingTransferModal open onClose source={Account} />` that records a `type='transfer'` transaction from `source` (funding) to a chosen spendable account.

- [ ] **Step 1: Write failing component test**

Create `src/components/account/FundingTransferModal.test.tsx` following the `TransferModal.test.tsx` mock pattern (supabase `from` mock, `useAuth` mock):

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../ui/Toast'
import { FundingTransferModal } from './FundingTransferModal'
import { createQueryClient, makeQueryChain } from '../../test/queryTestUtils'
import { todayISO } from '../../lib/dates'
import type { Account } from '../../types/database'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  accounts: [] as Account[],
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

const source: Account = { id: 'fund-1', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 0, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' }
const bank: Account = { id: 'acc-2', user_id: 'user-1', name: 'BCA', type: 'bank', opening_balance: 0, color: '#3b82f6', is_archived: false, created_at: '2026-01-01T00:00:00Z' }

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'accounts') {
        chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
      } else if (table === 'transactions') {
        chain.order.mockResolvedValue({ data: [], error: null })
        chain.insert.mockResolvedValue({ error: null })
      }
    }
    return mocks.chains[table]
  })
}

function renderModal() {
  const onClose = vi.fn()
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <FundingTransferModal open onClose={onClose} source={source} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onClose, client, ...view }
}

function form() {
  return document.querySelector('form') as HTMLFormElement
}

describe('FundingTransferModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.accounts = [source, bank]
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('does not list funding accounts as a transfer destination', async () => {
    renderModal()
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    await waitFor(() => expect(Array.from(toSelect.options).length).toBeGreaterThan(0))
    const toOptions = Array.from(toSelect.options).map((o) => o.value)
    expect(toOptions).toContain('acc-2')
    expect(toOptions).not.toContain('fund-1')
  })

  it('requires a valid amount', async () => {
    const { onClose } = renderModal()
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    await waitFor(() => expect(Array.from(toSelect.options).length).toBeGreaterThan(0))
    fireEvent.change(toSelect, { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: 'abc' } })
    fireEvent.submit(form())
    expect(await screen.findByText('Masukkan jumlah yang valid')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('creates a transfer transaction from the funding source to the bank', async () => {
    const { onClose } = renderModal()
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    await waitFor(() => expect(Array.from(toSelect.options).length).toBeGreaterThan(0))
    fireEvent.change(toSelect, { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '250000' } })

    await act(async () => {
      fireEvent.submit(form())
    })

    const tx = mocks.chains['transactions'] as ReturnType<typeof makeQueryChain>
    expect(tx.insert).toHaveBeenCalledWith(expect.objectContaining({
      account_id: 'fund-1',
      type: 'transfer',
      category_id: null,
      to_account_id: 'acc-2',
      amount: 250000,
      date: todayISO(),
      receipt_url: null,
      user_id: 'user-1',
    }))
    expect(await screen.findByText('Transfer berhasil')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails (module not found)**

Run: `npx vitest run src/components/account/FundingTransferModal.test.tsx`
Expected: FAIL — cannot find module `./FundingTransferModal`.

- [ ] **Step 3: Create `src/components/account/FundingTransferModal.tsx`**

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
import { isSpendableAccount } from '../../lib/accounts'
import type { Account } from '../../types/database'

export function FundingTransferModal({
  open,
  onClose,
  source,
}: {
  open: boolean
  onClose: () => void
  source: Account | null
}) {
  const { data: accounts } = useAccounts()
  const createTx = useCreateTransaction()
  const { toast } = useToast()
  const [to, setTo] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const destinations = useMemo(
    () => (accounts ?? []).filter((a) => !a.is_archived && a.id !== source?.id && isSpendableAccount(a)),
    [accounts, source],
  )

  useEffect(() => {
    if (!open) return
    setTo('')
    setAmountRaw('')
    setDate(todayISO())
    setNote('')
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!source) return
    if (!to) {
      toast('Pilih akun tujuan', 'error')
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
        account_id: source.id,
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
    <Modal open={open} onClose={onClose} title="Transfer dari Sumber Dana">
      {source ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-surface-soft px-4 py-3">
            <span className="text-xs font-medium text-ink-muted">Dari</span>
            <p className="text-sm font-semibold text-ink">{source.name}</p>
          </div>
          <Select label="Ke akun" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Pilih…</option>
            {destinations.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <div className="relative">
            <Input label="Jumlah (Rp)" inputMode="numeric" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} placeholder="0" />
            {parseAmountInput(amountRaw) !== null && (
              <span className="absolute right-3.5 bottom-9 text-xs text-ink-muted tabular">= {formatRupiah(parseAmountInput(amountRaw)!)}</span>
            )}
          </div>
          <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: penarikan profit" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Transfer'}</Button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/account/FundingTransferModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/account/FundingTransferModal.tsx src/components/account/FundingTransferModal.test.tsx
git commit -m "feat: add funding source to bank transfer modal"
```

---

### Task 5: Render funding sources section on the Accounts page

**Files:**
- Modify: `src/pages/AccountsPage.tsx`
- Test: `src/pages/AccountsPage.test.tsx`

**Interfaces:**
- Consumes: `isFundingAccount`/`isSpendableAccount` from `../../lib/accounts`, `spendableTotalBalance`/`totalFundingBalance` from `../../lib/balances`, `FundingTransferModal` from `../components/account/FundingTransferModal`.
- Produces: A "Sumber Dana" section (header + subtitle total + grid of funding cards) above the "Akun" list; global "Total saldo" uses `spendableTotalBalance`. Transfer button on a funding account opens `FundingTransferModal` with that account as `source`.

- [ ] **Step 1: Add failing tests for the funding section**

Append these tests to `src/pages/AccountsPage.test.tsx` (reuse existing `installMock`/`renderPage`/`mocks` helpers):

```tsx
it('renders funding sources in a separate section with their own total', async () => {
  mocks.accounts = [
    ...accounts,
    { id: 'fund-1', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 500000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  mocks.transactions = []
  renderPage()

  expect(await screen.findByText('Sumber Dana')).toBeInTheDocument()
  expect(screen.getByText('IB HFM')).toBeInTheDocument()
  expect(screen.getAllByText('Rp 500.000').length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('Total saldo')).toBeInTheDocument()
  expect(screen.getByText('Dompet')).toBeInTheDocument()
})

it('excludes funding accounts from the global total balance', async () => {
  mocks.accounts = [
    { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    { id: 'fund-1', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 500000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  mocks.transactions = []
  renderPage()

  await screen.findByText('Dompet')
  expect(screen.getByText('Rp 100.000')).toBeInTheDocument()
  expect(screen.queryByText('Rp 600.000')).not.toBeInTheDocument()
})

it('opens the funding transfer modal from a source card transfer button', async () => {
  mocks.accounts = [
    ...accounts,
    { id: 'fund-1', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 500000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  renderPage()
  await screen.findByText('IB HFM')
  fireEvent.click(screen.getAllByRole('button', { name: 'Transfer' }).find((b) => b.closest('div.rounded-2xl')?.textContent?.includes('IB HFM')) as HTMLButtonElement)
  expect(await screen.findByText('Transfer dari Sumber Dana')).toBeInTheDocument()
})
```

Note: existing test `renders the total balance, computed account balances...` (line ~113) expects `Rp 225.000` with only non-funding accounts; it remains valid. Existing test `shows the empty state...` expects `Belum ada akun` when `mocks.accounts = []` — keep the empty state predicate as-is.

- [ ] **Step 2: Run AccountsPage tests and confirm new ones fail**

Run: `npx vitest run src/pages/AccountsPage.test.tsx`
Expected: new tests FAIL (no Sumber Dana section yet); existing tests PASS.

- [ ] **Step 3: Modify `src/pages/AccountsPage.tsx`**

Add imports:

```ts
import { isFundingAccount, isSpendableAccount } from '../lib/accounts'
import { computeAccountBalances, spendableTotalBalance, totalFundingBalance } from '../lib/balances'
import { FundingTransferModal } from '../components/account/FundingTransferModal'
```

Add an icon import (already imports `ArrowLeftRight`): add `ArrowDownToLine` to the lucide-react import on line 2.

Change the total balance computation (line ~91):

```ts
const total = useMemo(
  () => spendableTotalBalance(balances, accounts ?? []),
  [balances, accounts],
)

const fundingTotal = useMemo(
  () => totalFundingBalance(balances, accounts ?? []),
  [balances, accounts],
)
```

Change the lists (lines ~102-103):

```ts
const funding = (accounts ?? []).filter((a) => !a.is_archived && isFundingAccount(a) && (owner === 'all' || a.user_id === owner))
const list = (accounts ?? []).filter((a) => !a.is_archived && isSpendableAccount(a) && (owner === 'all' || a.user_id === owner))
const archived = (accounts ?? []).filter((a) => a.is_archived && (owner === 'all' || a.user_id === owner))
```

Add a new piece of state near line 82:

```ts
const [fundingTransfer, setFundingTransfer] = useState<Account | null>(null)
```

Funding sources are created through the same "Tambah Akun" form (the new "Sumber Dana" type option from Task 1), so no extra create button is needed. Leave the existing header buttons unchanged.

Update `AccountCard` to accept an optional `onTransfer` prop and render a transfer button when the account is funding. Change the `AccountCardProps` interface and the render body:

```tsx
interface AccountCardProps {
  account: Account
  balances: Record<string, number>
  txCount: number
  members: Member[]
  onEdit: (a: Account) => void
  onToggleArchive: (a: Account) => void
  onDelete: (a: Account) => void
  onTransfer?: (a: Account) => void
}
```

Inside `AccountCard`, in the action row (non-readOnly block), add the transfer button for funding accounts before the edit button:

```tsx
{!readOnly && (
  <div className="flex gap-1">
    {account.type === 'funding' && onTransfer && (
      <Button variant="ghost" size="sm" onClick={() => onTransfer(account)} aria-label="Transfer">
        <ArrowDownToLine className="h-4 w-4" />
      </Button>
    )}
    <Button variant="ghost" size="sm" onClick={() => onEdit(account)} aria-label="Ubah">
      <Pencil className="h-4 w-4" />
    </Button>
    ...
  </div>
)}
```

Render the Sumber Dana section between the total card and the account list (after the `Total saldo` card, before `{list.length === 0 ? ...}`):

```tsx
{funding.length > 0 && (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-ink">Sumber Dana</h2>
      <span className="text-sm text-ink-muted tabular">{formatRupiah(fundingTotal)}</span>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {funding.map((a) => (
        <AccountCard
          key={a.id}
          account={a}
          balances={balances}
          txCount={txCountByAccount[a.id] ?? 0}
          members={members ?? []}
          onEdit={openEdit}
          onToggleArchive={toggleArchive}
          onDelete={setDeleting}
          onTransfer={setFundingTransfer}
        />
      ))}
    </div>
  </div>
)}
```

Render the `FundingTransferModal` next to the others (near line 214):

```tsx
<FundingTransferModal open={fundingTransfer !== null} onClose={() => setFundingTransfer(null)} source={fundingTransfer} />
```

- [ ] **Step 4: Run AccountsPage tests and confirm they pass**

Run: `npx vitest run src/pages/AccountsPage.test.tsx`
Expected: PASS (new + existing).

- [ ] **Step 5: Run full test suite + lint + build**

Run: `npm test; npm run lint; npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AccountsPage.tsx src/pages/AccountsPage.test.tsx
git commit -m "feat: show funding sources section on accounts page"
```

---

### Task 6: Final verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `tsc -b` clean and vite build succeeds.

- [ ] **Step 4: Migrations sanity**

Run: `supabase migration list --linked` (or `npx supabase migration list --linked`)
Expected: the new `20260821000000_funding_account_type` migration is listed and applied locally / available to push.

- [ ] **Step 5: Commit any remaining changes / done**

No code changes expected. If the last task had nothing to commit, report completion.
