import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import AccountsPage from './AccountsPage'
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

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../hooks/useMembers', () => ({
  useMembers: () => ({ data: mocks.members }),
}))

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-2', user_id: 'user-1', name: 'BCA', type: 'bank', opening_balance: 50000, color: '#3b82f6', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-3', user_id: 'user-1', name: 'Rekening Lama', type: 'other', opening_balance: 0, color: '#6366f1', is_archived: true, created_at: '2026-01-01T00:00:00Z' },
]

function makeTransactions(): Transaction[] {
  return [
    { id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'income', category_id: null, amount: 100000, to_account_id: null, note: '', date: '2026-08-10', receipt_url: null, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z' },
    { id: 'tx-2', user_id: 'user-1', account_id: 'acc-2', type: 'expense', category_id: null, amount: 25000, to_account_id: null, note: 'Kopi', date: '2026-08-05', receipt_url: null, created_at: '2026-08-05T00:00:00Z', updated_at: '2026-08-05T00:00:00Z' },
  ]
}

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'accounts') {
        chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
        chain.update.mockReturnValue(chain)
        chain.delete.mockReturnValue(chain)
        chain.eq.mockResolvedValue({ data: null, error: null })
        chain.insert.mockResolvedValue({ error: null })
      } else {
        chain.order.mockImplementation((col: unknown) =>
          col === 'created_at' ? Promise.resolve({ data: mocks.transactions, error: null }) : chain,
        )
        chain.eq.mockResolvedValue({ data: null, error: null })
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
          <AccountsPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.accounts = accounts
    mocks.transactions = []
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
    ]
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows a loading spinner while accounts are pending', () => {
    mocks.from.mockImplementation(() => {
      const chain = makeQueryChain()
      chain.order.mockReturnValue(new Promise(() => {}))
      return chain
    })
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows the empty state when there are no accounts', async () => {
    mocks.accounts = []
    renderPage()
    expect(await screen.findByText('Belum ada akun')).toBeInTheDocument()
    expect(screen.getByText('Tambah Akun')).toBeInTheDocument()
    expect(screen.getByText('Transfer')).toBeInTheDocument()
  })

  it('renders the total balance, computed account balances, and groups archived accounts', async () => {
    mocks.transactions = makeTransactions()
    renderPage()

    expect(await screen.findByText('Rp 225.000')).toBeInTheDocument()
    expect(screen.getByText('Dompet')).toBeInTheDocument()
    expect(screen.getByText('Rp 200.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 25.000')).toBeInTheDocument()
    expect(screen.getByText('Diarsipkan')).toBeInTheDocument()
    expect(screen.getByText('Rekening Lama')).toBeInTheDocument()
  })

  it('opens the create form from the header button and creates an account', async () => {
    const { client } = renderPage()
    await screen.findByText('Tambah Akun')
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah Akun' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tambah Akun')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Nama akun'), { target: { value: 'GoPay' } })
    fireEvent.change(within(dialog).getByLabelText('Tipe'), { target: { value: 'ewallet' } })

    client.setQueryData(['accounts', 'user-1'], mocks.accounts)
    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    const acc = mocks.chains['accounts']
    expect(acc?.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GoPay', type: 'ewallet', opening_balance: 0, user_id: 'user-1' }),
    )
    expect(await screen.findByText('Akun ditambahkan')).toBeInTheDocument()
  })

  it('opens a pre-filled form when editing an account', async () => {
    renderPage()
    await screen.findByText('Dompet')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('Edit Akun')).toBeInTheDocument()
    expect((within(dialog).getByLabelText('Nama akun') as HTMLInputElement).value).toBe('Dompet')
  })

  it('archives an account through the toggle button', async () => {
    renderPage()
    await screen.findByText('Dompet')
    const acc = mocks.chains['accounts']
    acc?.update.mockReturnValue(acc)
    acc?.eq.mockResolvedValue({ data: null, error: null })

    fireEvent.click(screen.getAllByRole('button', { name: 'Arsipkan' })[0] as HTMLButtonElement)
    await act(async () => {})

    expect(await screen.findByText('Akun diarsipkan')).toBeInTheDocument()
    expect(acc?.update).toHaveBeenCalledWith({ is_archived: true })
    expect(acc?.eq).toHaveBeenCalledWith('id', 'acc-1')
  })

  it('refuses to delete an account that has transactions and tells the user to archive it', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('Dompet')

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Hapus akun?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }))
    })

    expect(await screen.findByText('Akun ini punya transaksi — arsipkan saja, tidak bisa dihapus')).toBeInTheDocument()
    const acc = mocks.chains['accounts']
    expect(acc?.delete).not.toHaveBeenCalled()
  })

  it('deletes an account without transactions through the confirm dialog', async () => {
    renderPage()
    await screen.findByText('Dompet')
    const acc = mocks.chains['accounts']
    acc?.delete.mockReturnValue(acc)
    acc?.eq.mockResolvedValue({ data: null, error: null })

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Hapus akun?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }))
    })

    expect(await screen.findByText('Akun dihapus')).toBeInTheDocument()
    expect(acc?.delete).toHaveBeenCalled()
    expect(acc?.eq).toHaveBeenCalledWith('id', 'acc-1')
  })

  it('filters accounts by owner when a member is selected', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska', password_set: true },
    ]
    mocks.accounts = [
      { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'acc-2', user_id: 'user-2', name: 'Rekening Aska', type: 'bank', opening_balance: 50000, color: '#6366f1', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()

    expect(await screen.findByText('Dompet')).toBeInTheDocument()
    expect(screen.getByText('Rekening Aska')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Aska' }))

    expect(screen.queryByText('Dompet')).not.toBeInTheDocument()
    expect(screen.getByText('Rekening Aska')).toBeInTheDocument()
  })

  it('hides edit, archive, and delete buttons for foreign accounts', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska', password_set: true },
    ]
    mocks.accounts = [
      { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'acc-2', user_id: 'user-2', name: 'Rekening Aska', type: 'bank', opening_balance: 50000, color: '#6366f1', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()

    await screen.findByText('Dompet')

    const ownCard = screen.getByText('Dompet').closest('div.rounded-2xl') as HTMLElement
    expect(within(ownCard).getByRole('button', { name: 'Ubah' })).toBeInTheDocument()
    expect(within(ownCard).getByRole('button', { name: 'Arsipkan' })).toBeInTheDocument()
    expect(within(ownCard).getByRole('button', { name: 'Hapus' })).toBeInTheDocument()

    const foreignCard = screen.getByText('Rekening Aska').closest('div.rounded-2xl') as HTMLElement
    expect(within(foreignCard).queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument()
    expect(within(foreignCard).queryByRole('button', { name: 'Arsipkan' })).not.toBeInTheDocument()
    expect(within(foreignCard).queryByRole('button', { name: 'Hapus' })).not.toBeInTheDocument()
  })

  it('shows an owner chip with the member name on each account card', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska', password_set: true },
    ]
    mocks.accounts = [
      { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'acc-2', user_id: 'user-2', name: 'Rekening Aska', type: 'bank', opening_balance: 50000, color: '#6366f1', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()

    await screen.findByText('Dompet')

    const ownCard = screen.getByText('Dompet').closest('div.rounded-2xl') as HTMLElement
    expect(within(ownCard).getByText('Bima')).toBeInTheDocument()

    const foreignCard = screen.getByText('Rekening Aska').closest('div.rounded-2xl') as HTMLElement
    expect(within(foreignCard).getByText('Aska')).toBeInTheDocument()
  })
})
