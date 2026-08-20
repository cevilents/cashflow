import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import TransactionsPage from './TransactionsPage'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import type { Account, Category, Transaction } from '../types/database'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  transactions: [] as Transaction[],
  accounts: [] as Account[],
  categories: [] as Category[],
  members: [] as Member[],
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
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
  { id: 'acc-1', user_id: 'user-1', name: 'Tunai', type: 'cash', opening_balance: 0, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-2', user_id: 'user-1', name: 'BCA', type: 'bank', opening_balance: 0, color: '#3b82f6', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
]

const categories: Category[] = [
  { id: 'cat-in-1', user_id: 'user-1', name: 'Gaji', type: 'income', icon: 'bag', color: '#10b981', created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-ex-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'rice', color: '#ef4444', created_at: '2026-01-01T00:00:00Z' },
]

function makeTransactions(): Transaction[] {
  return [
    { id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'income', category_id: 'cat-in-1', amount: 100000, to_account_id: null, note: '', date: '2026-08-10', receipt_url: null, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z' },
    { id: 'tx-2', user_id: 'user-1', account_id: 'acc-2', type: 'expense', category_id: 'cat-ex-1', amount: 25000, to_account_id: null, note: 'Kopi', date: '2026-08-05', receipt_url: null, created_at: '2026-08-05T00:00:00Z', updated_at: '2026-08-05T00:00:00Z' },
    { id: 'tx-3', user_id: 'user-1', account_id: 'acc-1', type: 'transfer', category_id: null, amount: 50000, to_account_id: 'acc-2', note: '', date: '2026-08-01', receipt_url: null, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' },
  ]
}

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'transactions') {
        chain.order.mockImplementation((col: unknown) =>
          col === 'created_at' ? Promise.resolve({ data: mocks.transactions, error: null }) : chain,
        )
        chain.eq.mockResolvedValue({ data: null, error: null })
      } else if (table === 'accounts') {
        chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
      } else {
        chain.order.mockResolvedValue({ data: mocks.categories, error: null })
      }
    }
    return mocks.chains[table]
  })
}

function LocationProbe() {
  const [params] = useSearchParams()
  return <span data-testid="new-param">{params.get('new') ?? 'none'}</span>
}

function NavTrigger() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/transactions?new=1')}>buka-form</button>
}

function renderPage(initialEntries = ['/transactions']) {
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <ToastProvider>
          <TransactionsPage />
          <LocationProbe />
          <NavTrigger />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transactions = []
    mocks.accounts = accounts
    mocks.categories = categories
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
    ]
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows a loading spinner while transactions are pending', () => {
    mocks.from.mockImplementation(() => {
      const chain = makeQueryChain()
      chain.order.mockReturnValue(new Promise(() => {}))
      return chain
    })
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows the empty state when there are no transactions', async () => {
    renderPage()
    expect(await screen.findByText('Tidak ada transaksi')).toBeInTheDocument()
    expect(screen.getByText('Tambah')).toBeInTheDocument()
    expect(screen.getByText('Transaksi')).toBeInTheDocument()
  })

  it('lists transactions with summary totals and filters them by type and search', async () => {
    mocks.transactions = makeTransactions()
    renderPage()

    expect(await screen.findByText('+Rp 100.000')).toBeInTheDocument()
    expect(screen.getByText('-Rp 25.000')).toBeInTheDocument()
    expect(screen.getByText('Tunai → BCA')).toBeInTheDocument()
    expect(screen.getByText('Rp 100.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 25.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 50.000')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tipe transaksi'), { target: { value: 'income' } })
    expect(screen.queryByText('-Rp 25.000')).not.toBeInTheDocument()
    expect(screen.getByText('+Rp 100.000')).toBeInTheDocument()
    expect(screen.queryByText('Rp 25.000')).not.toBeInTheDocument()
    expect(screen.getByText('Rp 100.000')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tipe transaksi'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Cari'), { target: { value: 'kopi' } })
    expect(screen.queryByText('+Rp 100.000')).not.toBeInTheDocument()
    expect(screen.getByText('-Rp 25.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 25.000')).toBeInTheDocument()
    expect(screen.queryByText('Tunai → BCA')).not.toBeInTheDocument()
  })

  it('filters by category, account, and date range', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('+Rp 100.000')

    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    expect(screen.queryByText('+Rp 100.000')).not.toBeInTheDocument()
    expect(screen.getByText('-Rp 25.000')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Akun'), { target: { value: 'acc-1' } })
    expect(screen.queryByText('-Rp 25.000')).not.toBeInTheDocument()
    expect(screen.getByText('Tidak ada transaksi')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: '' } })
    expect(screen.getByText('+Rp 100.000')).toBeInTheDocument()
    expect(screen.getByText('Tunai → BCA')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Dari tanggal'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Sampai tanggal'), { target: { value: '2026-08-05' } })
    expect(screen.queryByText('+Rp 100.000')).not.toBeInTheDocument()
    expect(screen.getByText('Tunai → BCA')).toBeInTheDocument()
  })

  it('opens the create form from ?new=1 and clears the query param', async () => {
    renderPage(['/transactions?new=1'])
    expect(await screen.findByText('Tambah Transaksi')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('new-param')).toHaveTextContent('none'))
  })

  it('reopens the create form when navigating to ?new=1 while the page is mounted', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('+Rp 100.000')
    expect(screen.queryByText('Tambah Transaksi')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'buka-form' }))
    expect(await screen.findByText('Tambah Transaksi')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('new-param')).toHaveTextContent('none'))
  })

  it('opens a pre-filled form when editing a transaction', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('+Rp 100.000')

    fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Edit Transaksi')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Jumlah (Rp)') as HTMLInputElement).value).toBe('100000')
    expect((within(dialog).getByLabelText('Akun') as HTMLSelectElement).value).toBe('acc-1')
  })

  it('deletes a transaction through the confirm dialog', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('+Rp 100.000')

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(screen.getByText('Hapus transaksi?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }))
    })

    expect(await screen.findByText('Transaksi dihapus')).toBeInTheDocument()
    const txChain = mocks.chains['transactions']
    expect(txChain?.delete).toHaveBeenCalled()
    expect(txChain?.eq).toHaveBeenCalledWith('id', 'tx-1')
  })

  it('shows an error toast when deleting fails', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('+Rp 100.000')

    const txChain = mocks.chains['transactions']
    txChain?.eq.mockRejectedValue(new Error('boom'))

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }))
    })

    expect(await screen.findByText('Gagal menghapus transaksi')).toBeInTheDocument()
  })

  it('shows an error state and recovers when retrying', async () => {
    mocks.from.mockImplementation((table: string) => {
      const chain = makeQueryChain()
      if (table === 'accounts') chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
      else if (table === 'categories') chain.order.mockResolvedValue({ data: mocks.categories, error: null })
      else chain.order.mockRejectedValue(new Error('boom'))
      return chain
    })
    renderPage()
    expect(await screen.findByText('Gagal memuat transaksi')).toBeInTheDocument()

    mocks.from.mockImplementation((table: string) => {
      const chain = makeQueryChain()
      if (table === 'accounts') chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
      else if (table === 'categories') chain.order.mockResolvedValue({ data: mocks.categories, error: null })
      else {
        chain.order.mockImplementation((col: unknown) =>
          col === 'created_at' ? Promise.resolve({ data: makeTransactions(), error: null }) : chain,
        )
        chain.eq.mockResolvedValue({ data: null, error: null })
      }
      return chain
    })

    fireEvent.click(screen.getByRole('button', { name: 'Muat Ulang' }))
    expect(await screen.findByText('+Rp 100.000')).toBeInTheDocument()
  })

  it('narrows the list to a selected member via the filter', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska', password_set: true },
    ]
    mocks.transactions = [
      { id: 'tx-a', user_id: 'user-1', account_id: 'acc-1', type: 'income', category_id: 'cat-in-1', amount: 100000, to_account_id: null, note: '', date: '2026-08-10', receipt_url: null, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z' },
      { id: 'tx-b', user_id: 'user-2', account_id: 'acc-2', type: 'expense', category_id: 'cat-ex-1', amount: 25000, to_account_id: null, note: 'Kopi', date: '2026-08-05', receipt_url: null, created_at: '2026-08-05T00:00:00Z', updated_at: '2026-08-05T00:00:00Z' },
    ]
    renderPage()

    await screen.findByText('+Rp 100.000')
    fireEvent.click(screen.getByRole('button', { name: 'Aska' }))

    expect(screen.queryByText('+Rp 100.000')).not.toBeInTheDocument()
    expect(screen.getByText('-Rp 25.000')).toBeInTheDocument()
  })

  it('hides the Tambah button when filtering a foreign member', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska', password_set: true },
    ]
    mocks.transactions = makeTransactions()
    renderPage()

    await screen.findByText('+Rp 100.000')
    expect(screen.getByText('Tambah')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Aska' }))
    expect(screen.queryByText('Tambah')).not.toBeInTheDocument()
  })
})