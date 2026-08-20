import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ToastProvider } from '../components/ui/Toast'
import ReportsPage from './ReportsPage'
import { createQueryClient } from '../test/queryTestUtils'
import type { Account, Category, Transaction } from '../types/database'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  transactions: [] as Transaction[],
  accounts: [] as Account[],
  categories: [] as Category[],
  isLoading: false,
  downloadFile: vi.fn(),
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({ data: mocks.transactions, isLoading: mocks.isLoading }),
}))

vi.mock('../hooks/useAccounts', () => ({
  useAccounts: () => ({ data: mocks.accounts }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: mocks.categories }),
}))

vi.mock('../lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/csv')>()
  return { ...actual, downloadFile: mocks.downloadFile }
})

const account: Account = {
  id: 'acc-1', user_id: 'user-1', name: 'Tunai', type: 'cash', opening_balance: 0,
  color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z',
}

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: '', color: '#f43f5e', created_at: '2026-01-01T00:00:00Z' },
]

function makeTransactions(): Transaction[] {
  const now = new Date()
  const month = format(now, 'yyyy-MM')
  return [
    {
      id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'income', category_id: null,
      amount: 100000, to_account_id: null, note: 'Gaji', date: `${month}-01`, receipt_url: null,
      created_at: `${month}-01T00:00:00Z`, updated_at: `${month}-01T00:00:00Z`,
    },
    {
      id: 'tx-2', user_id: 'user-1', account_id: 'acc-1', type: 'expense', category_id: 'cat-1',
      amount: 25000, to_account_id: null, note: '', date: `${month}-05`, receipt_url: null,
      created_at: `${month}-05T00:00:00Z`, updated_at: `${month}-05T00:00:00Z`,
    },
  ]
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <ToastProvider>
          <ReportsPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReportsPage', () => {
  beforeEach(() => {
    mocks.transactions = []
    mocks.accounts = []
    mocks.categories = []
    mocks.isLoading = false
    mocks.downloadFile.mockClear()
  })

  afterEach(cleanup)

  it('shows a loading spinner while transactions are pending', () => {
    mocks.isLoading = true
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders summary cards, breakdown, and empty states with no data', async () => {
    renderPage()
    expect(await screen.findByText('Laporan')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 0')).toHaveLength(3)
    expect(screen.getByText('Tidak ada pengeluaran bulan ini')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('Cetak')).toBeInTheDocument()
  })

  it('computes income, expense, net, and category breakdown from filtered data', async () => {
    mocks.accounts = [account]
    mocks.categories = categories
    mocks.transactions = makeTransactions()
    renderPage()

    expect(await screen.findByText('Rp 100.000')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 25.000').length).toBeGreaterThan(0)
    expect(screen.getByText('Rp 75.000')).toBeInTheDocument()
    expect(screen.getByText('Makanan')).toBeInTheDocument()
  })

  it('exports a CSV on button click with the expected filename', async () => {
    mocks.accounts = [account]
    mocks.categories = categories
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('Laporan')

    const now = new Date()
    const month = format(now, 'yyyy-MM')
    fireEvent.click(screen.getByRole('button', { name: /csv/i }))

    expect(mocks.downloadFile).toHaveBeenCalledTimes(1)
    const [filename, content] = mocks.downloadFile.mock.calls[0] as [string, string]
    expect(filename).toBe(`cashflow-${month}.csv`)
    expect(content).toContain('"Tanggal","Tipe","Akun","Kategori","Jumlah","Catatan"')
    expect(content).toContain('"Pemasukan"')
    expect(content).toContain('"Pengeluaran"')
  })
})
