# Halaman Khusus "Sumber Dana" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move funding sources out of the Accounts page into a dedicated "Sumber Dana" page with its own sidebar route, and clean the bonus-funding section out of the Accounts page.

**Architecture:** Reuses all the funding-source machinery already in the codebase (`type='funding'`, `isFundingAccount`/`isSpendableAccount`, `spendableTotalBalance`/`totalFundingBalance`, `FundingTransferModal`, `AccountForm`). Adds one new page (`FundingSourcesPage`), a sidebar route `/sources`, an `AccountForm` `lockType` prop, and removes the funding section from `AccountsPage`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, TanStack Query, React Router v7, Vitest, React Testing Library, lucide-react.

## Global Constraints

- All UI copy in Indonesian (matches existing app).
- No new dependencies. No `any`; strict TypeScript (`npm run build` runs `tsc -b`).
- No DB migration changes (the `'funding'` type already exists and is deployed).
- `AccountsPage` becomes spendable-accounts-only; "Total saldo" on it stays non-funding.
- Funding sources live ONLY on the new `/sources` page; the bonus funding section is REMOVED from `AccountsPage`.
- Existing tests must keep passing; removed funding tests are replaced by new-page tests.
- Reuse existing components/helpers (do not duplicate logic).
- Commands: verify with `npm test`, `npm run lint`, `npm run build`.

---

### Task 1: Add `lockType` prop to `AccountForm`

**Files:**
- Modify: `src/components/account/AccountForm.tsx`
- Test: `src/components/account/AccountForm.test.tsx`

**Interfaces:**
- Consumes: `AccountType` from `src/types/database`.
- Produces: `AccountForm` accepts optional `lockType?: AccountType`. When set, the type state initializes to `lockType`, and the Tipe dropdown is NOT rendered (show the label text instead).

- [ ] **Step 1: Write the failing tests**

Append to `src/components/account/AccountForm.test.tsx` (reuse the existing `renderForm` helper; extend it to accept an optional prop). Modify the existing `renderForm` signature to accept `props?: Partial<ComponentProps<typeof AccountForm>>` and spread them, or add a new render helper:

```tsx
import type { ComponentProps } from 'react'
import type { AccountForm as AccountFormType } from './AccountForm'
```

Then add:

```tsx
it('locks the type to funding and hides the type dropdown when lockType is set', async () => {
  const onClose = vi.fn()
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AccountForm open onClose={onClose} editing={null} lockType="funding" />
      </ToastProvider>
    </QueryClientProvider>,
  )
  expect(screen.queryByLabelText('Tipe')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Nama akun'), { target: { value: 'IB HFM' } })
  fireEvent.change(screen.getByLabelText('Saldo awal (Rp)'), { target: { value: '500000' } })
  await act(async () => {
    fireEvent.submit(form())
  })
  expect(mocks.create).toHaveBeenCalledWith({
    name: 'IB HFM',
    type: 'funding',
    opening_balance: 500000,
    color: '#10b981',
  })
})

it('initializes editing type correctly when lockType is set', () => {
  // reuses the existing `account` fixture which has type 'bank'
  const onClose = vi.fn()
  const client = createQueryClient()
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AccountForm open onClose={onClose} editing={account} lockType="funding" />
      </ToastProvider>
    </QueryClientProvider>,
  )
  expect((screen.queryByLabelText('Tipe'))).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/components/account/AccountForm.test.tsx`
Expected: FAIL — the type dropdown still renders (`queryByLabelText('Tipe')` finds an element).

- [ ] **Step 3: Implement `lockType` in `AccountForm.tsx`**

Update the component props and state. Add `lockType` to the function signature:

```tsx
export function AccountForm({
  open,
  onClose,
  editing,
  lockType,
}: {
  open: boolean
  onClose: () => void
  editing?: Account | null
  lockType?: AccountType
}) {
```

In the `useEffect` reset block, when `editing` is null and `lockType` is set, use `lockType` instead of `'bank'`; when editing, keep `editing.type` (the edit case already does `setType(editing.type)`). Change the default reset:

```tsx
} else {
  setName('')
  setType(lockType ?? 'bank')
  setBalanceRaw('')
  setColor('#10b981')
}
```

In the JSX, wrap the Tipe `Select` so it is hidden when `lockType` is set:

```tsx
{!lockType && (
  <Select label="Tipe" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
    {Object.entries(accountTypeLabels).map(([value, label]) => (
      <option key={value} value={value}>{label}</option>
    ))}
  </Select>
)}
```

Note: `accountTypeLabels` is used only inside this conditional; keep the import (still used). If the import becomes unused, remove it.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/components/account/AccountForm.test.tsx`
Expected: PASS (new + existing).

- [ ] **Step 5: Run full lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/account/AccountForm.tsx src/components/account/AccountForm.test.tsx
git commit -m "feat: support lockType on AccountForm"
```

---

### Task 2: Add `Sumber Dana` sidebar entry and route

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/layout/Sidebar.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `path="/sources"` route rendering `FundingSourcesPage` (imported in `App.tsx`); sidebar nav includes `{ to: '/sources', label: 'Sumber Dana', icon: Landmark }`.

> NOTE: `FundingSourcesPage` does not exist yet — the route import in `App.tsx` will resolve after Task 3. This task adds the nav entry and a stub-safe approach. To keep the codebase compiling at the end of THIS task, create a minimal placeholder export is NOT ideal. Instead, order tasks so the page exists before wiring. If you implement this task standalone, add the route AFTER Task 3 is done. The plan runs sequentially, so implement this task but do the `App.tsx` route line AFTER Task 3 creates the page. For the commit to compile, you may add the sidebar entry + the relative `App.tsx` import and route together with the page in Task 3.

- [ ] **Step 1: Write the failing sidebar test**

Append to `src/components/layout/Sidebar.test.tsx`. Update `navLabels` to include `'Sumber Dana'` (mobile nav slice(0,5) — after adding Sumber Dana at index 2, the first 5 become Dashboard, Transaksi, Sumber Dana, Akun, Kategori). Check the ordering decision in the spec: Sumber Dana placed after Akun.

Decide the insertion index: place `Sumber Dana` between `Akun` and `Kategori`. Then `nav` = Dashboard(0), Transaksi(1), Akun(2), Sumber Dana(3), Kategori(4), Berulang(5), ... Mobile slice(0,5) = Dashboard, Transaksi, Akun, Sumber Dana, Kategori.

Add to the "lists every navigation item" test:

```tsx
expect(byLabel['Sumber Dana']).toHaveAttribute('href', '/sources')
```

Update `navLabels` and the mobile-nav test expectations to match the new slice:
- `navLabels = ['Dashboard', 'Transaksi', 'Akun', 'Sumber Dana', 'Kategori']`
- the existing `expect(links).toEqual(navLabels)` should still pass with the new order.
- `expect(links).not.toContain('Laporan')` / `not.toContain('Pengaturan')` stay valid.

Also add a route in the test's MockRouter for `/sources`:
```tsx
<Route path="/sources" element={<p>sources-content</p>} />
```

- [ ] **Step 2: Run the sidebar test and confirm it fails**

Run: `npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: FAIL — no "Sumber Dana" link.

- [ ] **Step 3: Implement in `Sidebar.tsx`**

Add `Landmark` to the lucide-react imports. Add the nav entry:

```tsx
const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Akun', icon: Wallet },
  { to: '/sources', label: 'Sumber Dana', icon: Landmark },
  { to: '/categories', label: 'Kategori', icon: Tags },
  { to: '/recurring', label: 'Berulang', icon: CalendarClock },
  { to: '/reports', label: 'Laporan', icon: FileChartColumn },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]
```

- [ ] **Step 4: Run the sidebar test and confirm it passes**

Run: `npx vitest run src/components/layout/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Sidebar.test.tsx
git commit -m "feat: add Sumber Dana sidebar entry"
```

> The `App.tsx` route is added in Task 4 (which creates `FundingSourcesPage`) so the import resolves. Do NOT add it in this task.

---

### Task 3: Remove the funding section from `AccountsPage`

**Files:**
- Modify: `src/pages/AccountsPage.tsx`
- Test: `src/pages/AccountsPage.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AccountsPage` renders only spendable accounts; the "Sumber Dana" section, `fundingTransfer` state, `fundingTotal`, `funding` list, `onTransfer` prop, transfer button, and related imports are removed. "Total saldo" still uses `spendableTotalBalance`.

- [ ] **Step 1: Update tests — remove the 3 funding-source tests**

In `src/pages/AccountsPage.test.tsx`, remove the three tests added for the previous feature:
- "renders funding sources in a separate section with their own total"
- "excludes funding accounts from the global total balance"
- "opens the funding transfer modal from a source card transfer button"

Add a test that funding accounts do NOT appear on the Accounts page:

```tsx
it('does not render funding sources on the accounts page', async () => {
  mocks.accounts = [
    { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    { id: 'fund-1', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 500000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  ]
  mocks.transactions = []
  renderPage()
  await screen.findByText('Dompet')
  expect(screen.queryByText('IB HFM')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run AccountsPage tests and confirm funding tests fail/are removed**

Run: `npx vitest run src/pages/AccountsPage.test.tsx`
Expected: the new "does not render funding" test currently FAILS (IB HFM still shows on the page because the funding section is still there).

- [ ] **Step 3: Modify `AccountsPage.tsx`**

Remove the following (keep $spendable logic):
- Import line for `isFundingAccount` — remove `isFundingAccount` from the `../../lib/accounts` import (keep `isSpendableAccount`).
- Import lines for `spendableTotalBalance`/`totalFundingBalance` → keep `spendableTotalBalance`, REMOVE `totalFundingBalance`.
- Import for `FundingTransferModal`.
- `ArrowDownToLine` from lucide-react import.
- State `const [fundingTransfer, setFundingTransfer] = useState<Account | null>(null)`.
- Memo `fundingTotal`.
- Variable `funding = ...`.
- The `{funding.length > 0 && (...)}` JSX section.
- The `onTransfer={setFundingTransfer}` prop on the funding card (the whole Funding section's `AccountCard` usage).
- The transfer button `{account.type === 'funding' && onTransfer && (...)}` and the `onTransfer` property on `AccountCardProps` / destructuring.
- The `<FundingTransferModal ...>` render.

Keep `const list = ...isSpendableAccount(a)...` and `const total = ...spendableTotalBalance(...)`.

- [ ] **Step 4: Run AccountsPage tests and confirm they pass**

Run: `npx vitest run src/pages/AccountsPage.test.tsx`
Expected: PASS (new "does not render funding" + all existing).

- [ ] **Step 5: Run full lint + build**

Run: `npm run lint; npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AccountsPage.tsx src/pages/AccountsPage.test.tsx
git commit -m "refactor: remove funding section from accounts page"
```

---

### Task 4: Create `FundingSourcesPage` and wire the route

**Files:**
- Create: `src/pages/FundingSourcesPage.tsx`
- Test: `src/pages/FundingSourcesPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useAccounts` (`src/hooks/useAccounts`), `useTransactions` (`src/hooks/useTransactions`), `useMembers` (`src/hooks/useMembers`), `useReadOnly`/`useCurrentMember` (`src/hooks/useReadOnly`), `computeAccountBalances`/`totalFundingBalance`/`spendableTotalBalance` (`src/lib/balances`), `isFundingAccount` (`src/lib/accounts`), `formatRupiah` (`src/lib/format`), `getMemberById` (`src/lib/members`), `AccountForm` (with `lockType="funding"`), `FundingTransferModal`, `MemberFilter`, UI components.
- Produces: `<FundingSourcesPage />` (default export) rendering the dedicated funding page; route `/sources` wired in `App.tsx`.

- [ ] **Step 1: Write the failing component test**

Create `src/pages/FundingSourcesPage.test.tsx` following the `AccountsPage.test.tsx` mock pattern (`mocks.from`, `makeQueryChain`, `useAuth`/`useMembers` mocks). Tests:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import FundingSourcesPage from './FundingSourcesPage'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import type { Account, Transaction } from '../types/database'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  accounts: [] as Account[],
  transactions: [] as Transaction[],
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
  members: [] as Member[],
}))

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../hooks/useMembers', () => ({ useMembers: () => ({ data: mocks.members }) }))

const funding: Account = { id: 'fund-1', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 500000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' }
const spendable: Account = { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' }

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'accounts') {
        chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
      } else {
        chain.order.mockImplementation((col: unknown) =>
          col === 'created_at' ? Promise.resolve({ data: mocks.transactions, error: null }) : chain,
        )
        chain.eq.mockResolvedValue({ data: null, error: null })
        chain.insert.mockResolvedValue({ error: null })
      }
    }
    return mocks.chains[table]
  })
}

function renderPage() {
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <FundingSourcesPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

describe('FundingSourcesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
    ]
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows only funding accounts with their balances and a subtotal', async () => {
    mocks.accounts = [funding, spendable]
    mocks.transactions = []
    renderPage()
    expect(await screen.findByText('IB HFM')).toBeInTheDocument()
    expect(screen.queryByText('Dompet')).not.toBeInTheDocument()
    // funding subtotal = 500000 (spendable excluded)
    expect(screen.getAllByText('Rp 500.000').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the empty state when there are no funding accounts', async () => {
    mocks.accounts = [spendable]
    renderPage()
    expect(await screen.findByText('Belum ada sumber dana')).toBeInTheDocument()
  })

  it('opens the create form with funding type locked', async () => {
    mocks.accounts = [funding]
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Tambah Sumber Dana' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText('Tipe')).not.toBeInTheDocument()
  })

  it('opens the funding transfer modal from a source card transfer button', async () => {
    mocks.accounts = [funding]
    renderPage()
    await screen.findByText('IB HFM')
    fireEvent.click(screen.getAllByRole('button', { name: 'Transfer' }).find((b) => b.closest('div.rounded-2xl')?.textContent?.includes('IB HFM')) as HTMLButtonElement)
    expect(await screen.findByText('Transfer dari Sumber Dana')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails (module missing)**

Run: `npx vitest run src/pages/FundingSourcesPage.test.tsx`
Expected: FAIL — cannot find module `./FundingSourcesPage`.

- [ ] **Step 3: Create `src/pages/FundingSourcesPage.tsx`**

Model closely on `src/pages/AccountsPage.tsx` but restricted to funding accounts. Key structure:

```tsx
import { useMemo, useState } from 'react'
import { Plus, Pencil, Archive, Trash2 } from 'lucide-react'
import { useAccounts, useDeleteAccount, useUpdateAccount } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useMembers } from '../hooks/useMembers'
import { useReadOnly, useCurrentMember } from '../hooks/useReadOnly'
import { computeAccountBalances, totalFundingBalance } from '../lib/balances'
import { isFundingAccount } from '../lib/accounts'
import { formatRupiah } from '../lib/format'
import { getMemberById } from '../lib/members'
import type { Member } from '../lib/members'
import { AccountForm } from '../components/account/AccountForm'
import { FundingTransferModal } from '../components/account/FundingTransferModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { MemberFilter } from '../components/layout/MemberFilter'
import type { OwnerFilter } from '../components/layout/MemberFilter'
import type { Account } from '../types/database'

interface SourceCardProps {
  account: Account
  balances: Record<string, number>
  members: Member[]
  onEdit: (a: Account) => void
  onToggleArchive: (a: Account) => void
  onDelete: (a: Account) => void
  onTransfer: (a: Account) => void
}

function SourceCard({ account, balances, members, onEdit, onToggleArchive, onDelete, onTransfer }: SourceCardProps) {
  const readOnly = useReadOnly(account.user_id)
  const member = getMemberById(account.user_id, members)
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: account.color }} />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{account.name}</h3>
        {member && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: member.color }} />
            {member.name}
          </span>
        )}
        <span className="shrink-0 text-xs text-ink-muted">Sumber Dana</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-ink tabular">{formatRupiah(balances[account.id] ?? 0)}</p>
      <div className="mt-4 flex items-center justify-end">
        {!readOnly && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => onTransfer(account)} aria-label="Transfer">
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(account)} aria-label="Ubah">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onToggleArchive(account)} aria-label={account.is_archived ? 'Aktifkan' : 'Arsipkan'}>
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(account)} aria-label="Hapus" className="text-bad">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FundingSourcesPage() {
  const { data: accounts, isLoading } = useAccounts()
  const { data: transactions } = useTransactions()
  const { data: members } = useMembers()
  const currentMember = useCurrentMember()
  const deleteAcc = useDeleteAccount()
  const archiveAcc = useUpdateAccount()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [transferSource, setTransferSource] = useState<Account | null>(null)
  const [owner, setOwner] = useState<OwnerFilter>('all')

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

  const fundingTotal = useMemo(
    () => totalFundingBalance(balances, accounts ?? []),
    [balances, accounts],
  )

  const list = (accounts ?? []).filter((a) => !a.is_archived && isFundingAccount(a) && (owner === 'all' || a.user_id === owner))
  const archived = (accounts ?? []).filter((a) => a.is_archived && isFundingAccount(a) && (owner === 'all' || a.user_id === owner))

  const openEdit = (a: Account) => { setEditing(a); setFormOpen(true) }

  const confirmDelete = async () => {
    if (!deleting) return
    if ((txCountByAccount[deleting.id] ?? 0) > 0) {
      toast('Sumber dana ini punya transaksi — arsipkan saja, tidak bisa dihapus', 'error')
      setDeleting(null)
      return
    }
    try {
      await deleteAcc.mutateAsync(deleting.id)
      toast('Sumber dana dihapus')
      setDeleting(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus sumber dana', 'error')
      setDeleting(null)
    }
  }

  const toggleArchive = async (a: Account) => {
    try {
      await archiveAcc.mutateAsync({ id: a.id, is_archived: !a.is_archived })
      toast(a.is_archived ? 'Sumber dana diaktifkan kembali' : 'Sumber dana diarsipkan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal mengarsipkan sumber dana', 'error')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={28} /></div>
  }

  const canManage = owner === 'all' || owner === currentMember?.id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Sumber Dana</h1>
          <p className="text-sm text-ink-muted">Saldo sumber dana dan transfer ke akun</p>
        </div>
        {canManage && (
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" /> Tambah Sumber Dana
          </Button>
        )}
      </div>

      <MemberFilter value={owner} onChange={setOwner} />

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <span className="text-xs font-medium text-ink-muted">Total sumber dana</span>
        <p className="mt-1 text-3xl font-bold text-ink tabular">{formatRupiah(fundingTotal)}</p>
      </div>

      {list.length === 0 ? (
        <EmptyState title="Belum ada sumber dana" message="Buat sumber dana (IB Exness, IB HFM, LYNK.ID, dll) untuk mulai mencatat." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <SourceCard
              key={a.id}
              account={a}
              balances={balances}
              members={members ?? []}
              onEdit={openEdit}
              onToggleArchive={toggleArchive}
              onDelete={setDeleting}
              onTransfer={setTransferSource}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">Diarsipkan</h2>
          <div className="grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((a) => (
              <SourceCard key={a.id} account={a} balances={balances} members={members ?? []} onEdit={openEdit} onToggleArchive={toggleArchive} onDelete={setDeleting} onTransfer={setTransferSource} />
            ))}
          </div>
        </div>
      )}

      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} lockType="funding" />
      <FundingTransferModal open={transferSource !== null} onClose={() => setTransferSource(null)} source={transferSource} />
      <ConfirmDialog
        open={deleting !== null}
        title="Hapus sumber dana?"
        message="Sumber dana yang punya transaksi tidak bisa dihapus dan harus diarsipkan."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
```

> Add `ArrowDownToLine` to the lucide-react import on the first line of the component above (the `Plus, Pencil, Archive, Trash2` import line). If `txCountByAccount` is only used for delete gating, keep it; otherwise remove if unused (verify with lint).

- [ ] **Step 4: Wire the route in `App.tsx`**

Add import and route:

```tsx
import FundingSourcesPage from './pages/FundingSourcesPage'
// ...
<Route path="/sources" element={<FundingSourcesPage />} />
```

- [ ] **Step 5: Run the new tests and confirm they pass**

Run: `npx vitest run src/pages/FundingSourcesPage.test.tsx src/components/layout/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run full suite + lint + build**

Run: `npm test; npm run lint; npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/FundingSourcesPage.tsx src/pages/FundingSourcesPage.test.tsx src/App.tsx
git commit -m "feat: add dedicated funding sources page"
```

---

### Task 5: Final verification

**Files:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all green (matches previous baseline plus the new page tests; ~316 tests).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (2 pre-existing warnings in TransactionFilters.tsx / Toast.tsx).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: `tsc -b` clean and vite build succeeds.

- [ ] **Step 4: Manual spec spot-check**

The route `/sources` renders the funding page; `/accounts` no longer shows funding; sidebar shows "Sumber Dana". (Done via component tests; no DB migration involved.)

- [ ] **Step 5: Commit any remaining changes / done**

No code changes expected. Report completion.
