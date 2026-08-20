import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import RecurringPage from './RecurringPage'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import type { RecurringTransaction, Account, Category } from '../types/database'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  recurring: [] as RecurringTransaction[],
  accounts: [] as Account[],
  categories: [] as Category[],
  today: '2026-08-20',
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../lib/dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/dates')>()),
  todayISO: () => mocks.today,
}))

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-2', user_id: 'user-1', name: 'BCA', type: 'bank', opening_balance: 50000, color: '#3b82f6', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
]

const categories: Category[] = [
  { id: 'cat-exp', user_id: 'user-1', name: 'Listrik', type: 'expense', icon: 'energy', color: '#f59e0b', created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-inc', user_id: 'user-1', name: 'Gaji', type: 'income', icon: 'salary', color: '#10b981', created_at: '2026-01-01T00:00:00Z' },
]

const recurring: RecurringTransaction[] = [
  { id: 'rec-1', user_id: 'user-1', name: 'Gaji', account_id: 'acc-2', category_id: 'cat-inc', type: 'income', amount: 5000000, frequency: 'monthly', next_due_date: '2026-09-01', is_active: true, created_at: '2026-08-01T00:00:00Z' },
  { id: 'rec-2', user_id: 'user-1', name: 'Listrik', account_id: 'acc-1', category_id: 'cat-exp', type: 'expense', amount: 250000, frequency: 'monthly', next_due_date: '2026-08-21', is_active: true, created_at: '2026-08-02T00:00:00Z' },
  { id: 'rec-3', user_id: 'user-1', name: 'Netflix', account_id: 'acc-1', category_id: 'cat-exp', type: 'expense', amount: 149000, frequency: 'monthly', next_due_date: '2026-09-05', is_active: false, created_at: '2026-08-03T00:00:00Z' },
]

function buildChain(table: string) {
  const chain = makeQueryChain()
  if (table === 'recurring_transactions') {
    chain.order.mockImplementation(() => Promise.resolve({ data: mocks.recurring, error: null }))
    chain.update.mockReturnValue(chain)
    chain.delete.mockReturnValue(chain)
    chain.eq.mockResolvedValue({ data: null, error: null })
    chain.insert.mockResolvedValue({ error: null })
  } else if (table === 'accounts') {
    chain.order.mockResolvedValue({ data: mocks.accounts, error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
  } else if (table === 'categories') {
    chain.order.mockResolvedValue({ data: mocks.categories, error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
  } else {
    chain.insert.mockResolvedValue({ error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
  }
  return chain
}

function installMock() {
  mocks.chains['recurring_transactions'] = buildChain('recurring_transactions')
  mocks.chains['accounts'] = buildChain('accounts')
  mocks.chains['categories'] = buildChain('categories')
  mocks.chains['transactions'] = buildChain('transactions')
  mocks.from.mockImplementation((table: string) => mocks.chains[table])
}

function renderPage() {
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <RecurringPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

describe('RecurringPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.recurring = recurring
    mocks.accounts = accounts
    mocks.categories = categories
    mocks.today = '2026-08-20'
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows a loading spinner while recurring transactions are pending', () => {
    mocks.from.mockImplementation(() => {
      const chain = makeQueryChain()
      chain.order.mockReturnValue(new Promise(() => {}))
      return chain
    })
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows the empty state with a CTA when there are no recurring transactions', async () => {
    mocks.recurring = []
    renderPage()
    expect(await screen.findByText('Belum ada transaksi berulang')).toBeInTheDocument()
    expect(screen.getByText('Tambah')).toBeInTheDocument()
  })

  it('renders active and paused items with type, amount, frequency, account, and next due date', async () => {
    renderPage()
    expect(await screen.findByText('Gaji')).toBeInTheDocument()
    expect(screen.getByText('Listrik')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Pemasukan')).toBeInTheDocument()
    expect(screen.getAllByText('Pengeluaran')).toHaveLength(2)
    expect(screen.getByText('+Rp 5.000.000')).toBeInTheDocument()
    expect(screen.getByText('-Rp 250.000')).toBeInTheDocument()
    expect(screen.getAllByText(/Bulanan/)).toHaveLength(3)
    expect(screen.getByText(/Jatuh tempo 21 Aug 2026/)).toBeInTheDocument()
    expect(screen.getByText(/nonaktif/)).toBeInTheDocument()
  })

  it('opens a pre-filled form when editing a recurring transaction', async () => {
    renderPage()
    await screen.findByText('Gaji')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('Edit Transaksi Berulang')).toBeInTheDocument()
    expect((within(dialog).getByLabelText('Nama') as HTMLInputElement).value).toBe('Gaji')
    expect((within(dialog).getByLabelText('Jumlah (Rp)') as HTMLInputElement).value).toBe('5000000')
  })

  it('validates required fields on create and refuses to submit', async () => {
    renderPage()
    await screen.findByText('Gaji')
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Nama'), { target: { value: '' } })
    fireEvent.change(within(dialog).getByLabelText('Akun'), { target: { value: '' } })
    fireEvent.change(within(dialog).getByLabelText('Kategori'), { target: { value: '' } })
    fireEvent.change(within(dialog).getByLabelText('Jumlah (Rp)'), { target: { value: '0' } })

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    expect(await screen.findByText('Nama wajib diisi')).toBeInTheDocument()
    expect(mocks.chains['recurring_transactions']?.insert).not.toHaveBeenCalled()
  })

  it('creates a recurring transaction with a payload matching the schema', async () => {
    renderPage()
    await screen.findByText('Gaji')
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Nama'), { target: { value: 'Internet' } })
    fireEvent.change(within(dialog).getByLabelText('Tipe'), { target: { value: 'expense' } })
    fireEvent.change(within(dialog).getByLabelText('Akun'), { target: { value: 'acc-1' } })
    fireEvent.change(within(dialog).getByLabelText('Kategori'), { target: { value: 'cat-exp' } })
    fireEvent.change(within(dialog).getByLabelText('Jumlah (Rp)'), { target: { value: '300000' } })
    fireEvent.change(within(dialog).getByLabelText('Jatuh tempo berikutnya'), { target: { value: '2026-09-01' } })

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    const rec = mocks.chains['recurring_transactions']
    expect(rec?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Internet',
        type: 'expense',
        account_id: 'acc-1',
        category_id: 'cat-exp',
        amount: 300000,
        frequency: 'monthly',
        next_due_date: '2026-09-01',
        is_active: true,
        user_id: 'user-1',
      }),
    )
    expect(await screen.findByText('Transaksi berulang ditambahkan')).toBeInTheDocument()
  })

  it('requires a category for an income type', async () => {
    renderPage()
    await screen.findByText('Gaji')
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Tipe'), { target: { value: 'income' } })
    fireEvent.change(within(dialog).getByLabelText('Nama'), { target: { value: 'Bonus' } })
    fireEvent.change(within(dialog).getByLabelText('Akun'), { target: { value: 'acc-2' } })

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    expect(await screen.findByText('Pilih kategori')).toBeInTheDocument()
    expect(mocks.chains['recurring_transactions']?.insert).not.toHaveBeenCalled()
  })

  it('updates an existing recurring transaction through the form', async () => {
    renderPage()
    await screen.findByText('Listrik')
    const dialogNotOpen = screen.queryByRole('dialog')
    expect(dialogNotOpen).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[1] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    const rec = mocks.chains['recurring_transactions']

    fireEvent.change(within(dialog).getByLabelText('Nama'), { target: { value: 'Listrik PLN' } })

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    expect(await screen.findByText('Transaksi berulang diperbarui')).toBeInTheDocument()
    expect(rec?.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Listrik PLN' }))
    expect(rec?.eq).toHaveBeenCalledWith('id', 'rec-2')
  })

  it('toggles an active recurring transaction off and on', async () => {
    renderPage()
    await screen.findByText('Gaji')
    const rec = mocks.chains['recurring_transactions']

    fireEvent.click(screen.getAllByRole('button', { name: 'Nonaktifkan' })[0] as HTMLButtonElement)
    await act(async () => {})
    expect(rec?.update).toHaveBeenCalledWith({ is_active: false })
    expect(rec?.eq).toHaveBeenCalledWith('id', 'rec-1')

    fireEvent.click(screen.getByRole('button', { name: 'Aktifkan' }))
    await act(async () => {})
    expect(rec?.update).toHaveBeenCalledWith({ is_active: true })
    expect(rec?.eq).toHaveBeenCalledWith('id', 'rec-3')
  })

  it('deletes a recurring transaction through the confirm dialog', async () => {
    renderPage()
    await screen.findByText('Gaji')
    const rec = mocks.chains['recurring_transactions']
    rec?.delete.mockReturnValue(rec)

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Hapus transaksi berulang?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }))
    })

    expect(await screen.findByText('Transaksi berulang dihapus')).toBeInTheDocument()
    expect(rec?.delete).toHaveBeenCalled()
    expect(rec?.eq).toHaveBeenCalledWith('id', 'rec-1')
  })

  it('disables the confirm button and ignores extra clicks while a delete is pending', async () => {
    renderPage()
    await screen.findByText('Gaji')
    const rec = mocks.chains['recurring_transactions']
    rec?.delete.mockReturnValue(rec)
    rec?.eq.mockReturnValue(new Promise(() => {}))

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Hapus transaksi berulang?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: 'Hapus' })
    expect(confirmBtn).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    const loadingBtn = await within(dialog).findByRole('button', { name: 'Menghapus…' })
    expect(loadingBtn).toBeDisabled()

    await act(async () => {
      fireEvent.click(loadingBtn)
    })

    expect(rec?.delete).toHaveBeenCalledTimes(1)
  })

  it('records now: creates a transaction with todays date then advances next_due_date', async () => {
    renderPage()
    await screen.findByText('Gaji')
    const tx = mocks.chains['transactions']
    const rec = mocks.chains['recurring_transactions']
    rec?.update.mockReturnValue(rec)

    fireEvent.click(screen.getAllByRole('button', { name: 'Catat sekarang' })[0] as HTMLButtonElement)
    await act(async () => {})

    expect(tx?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc-2',
        type: 'income',
        category_id: 'cat-inc',
        amount: 5000000,
        to_account_id: null,
        note: 'Gaji',
        date: '2026-08-20',
        receipt_url: null,
        user_id: 'user-1',
      }),
    )
    expect(rec?.update).toHaveBeenCalledWith({ next_due_date: '2026-10-01' })
    expect(rec?.eq).toHaveBeenCalledWith('id', 'rec-1')
    expect(await screen.findByText('Dicatat hari ini, jatuh tempo digeser')).toBeInTheDocument()
  })

  it('advances a weekly frequency correctly when recording now', async () => {
    mocks.recurring = [
      { id: 'rec-w', user_id: 'user-1', name: 'Pulsa', account_id: 'acc-1', category_id: 'cat-exp', type: 'expense', amount: 50000, frequency: 'weekly', next_due_date: '2026-08-19', is_active: true, created_at: '2026-08-01T00:00:00Z' },
    ]
    renderPage()
    await screen.findByText('Pulsa')
    const rec = mocks.chains['recurring_transactions']
    rec?.update.mockReturnValue(rec)

    fireEvent.click(screen.getByRole('button', { name: 'Catat sekarang' }))
    await act(async () => {})
    expect(rec?.update).toHaveBeenCalledWith({ next_due_date: '2026-08-26' })
  })

  it('advances a yearly frequency correctly when recording now', async () => {
    mocks.recurring = [
      { id: 'rec-y', user_id: 'user-1', name: 'Asuransi', account_id: 'acc-2', category_id: 'cat-exp', type: 'expense', amount: 1200000, frequency: 'yearly', next_due_date: '2026-08-19', is_active: true, created_at: '2026-08-01T00:00:00Z' },
    ]
    renderPage()
    await screen.findByText('Asuransi')
    const rec = mocks.chains['recurring_transactions']
    rec?.update.mockReturnValue(rec)

    fireEvent.click(screen.getByRole('button', { name: 'Catat sekarang' }))
    await act(async () => {})
    expect(rec?.update).toHaveBeenCalledWith({ next_due_date: '2027-08-19' })
  })

  it('guards against double record-now while a recording is pending', async () => {
    renderPage()
    await screen.findByText('Gaji')
    const tx = mocks.chains['transactions']
    tx?.insert.mockReturnValue(new Promise(() => {}))

    const btn = screen.getAllByRole('button', { name: 'Catat sekarang' })[0] as HTMLButtonElement
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
    await act(async () => {})
  })
})
