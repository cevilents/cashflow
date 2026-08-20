import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { ToastProvider } from '../components/ui/Toast'
import DashboardPage from './DashboardPage'
import { createQueryClient } from '../test/queryTestUtils'
import type { Account, Category, Transaction } from '../types/database'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  transactions: [] as Transaction[],
  accounts: [] as Account[],
  categories: [] as Category[],
  isLoading: false,
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../hooks/useTransactions', () => ({
  useTransactions: () => ({ data: mocks.transactions, isLoading: mocks.isLoading }),
  useUpdateTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../hooks/useAccounts', () => ({
  useAccounts: () => ({ data: mocks.accounts }),
}))

vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: mocks.categories }),
}))

const account: Account = {
  id: 'acc-1',
  user_id: 'user-1',
  name: 'Tunai',
  type: 'cash',
  opening_balance: 0,
  color: '#10b981',
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
}

const categories: Category[] = [
  { id: 'cat-ex-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: '', color: '#ef4444', created_at: '2026-01-01T00:00:00Z' },
]

function makeTransactions(): Transaction[] {
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const lastMonth = format(subMonths(now, 1), 'yyyy-MM-dd')

  return [
    {
      id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'income', category_id: null,
      amount: 100000, to_account_id: null, note: '', date: today, receipt_url: null,
      created_at: `${today}T00:00:00Z`, updated_at: `${today}T00:00:00Z`,
    },
    {
      id: 'tx-2', user_id: 'user-1', account_id: 'acc-1', type: 'expense', category_id: 'cat-ex-1',
      amount: 25000, to_account_id: null, note: '', date: today, receipt_url: null,
      created_at: `${today}T00:00:00Z`, updated_at: `${today}T00:00:00Z`,
    },
    {
      id: 'tx-3', user_id: 'user-1', account_id: 'acc-1', type: 'expense', category_id: 'cat-ex-1',
      amount: 5000, to_account_id: null, note: '', date: lastMonth, receipt_url: null,
      created_at: `${lastMonth}T00:00:00Z`, updated_at: `${lastMonth}T00:00:00Z`,
    },
  ]
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.transactions = []
    mocks.accounts = []
    mocks.categories = []
    mocks.isLoading = false
  })

  afterEach(cleanup)

  it('shows a loading spinner while data is pending', () => {
    mocks.isLoading = true
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows empty states and zero summaries when there is no data', async () => {
    renderPage()
    expect(await screen.findByText('Total Saldo')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 0')).toHaveLength(3)
    expect(screen.getByText('Belum ada transaksi')).toBeInTheDocument()
    expect(screen.getByText('Belum ada data')).toBeInTheDocument()
    expect(screen.getByText('Tambah Transaksi')).toBeInTheDocument()
  })

  it('shows the summary numbers and recent transactions with data', async () => {
    mocks.accounts = [account]
    mocks.categories = categories
    mocks.transactions = makeTransactions()
    renderPage()

    expect(await screen.findByText('Pemasukan')).toBeInTheDocument()
    expect(screen.getAllByText('Makanan').length).toBeGreaterThan(0)
    expect(screen.getByText('Rp 70.000')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 25.000').length).toBeGreaterThan(0)
    expect(screen.queryByText('Belum ada transaksi')).not.toBeInTheDocument()
  })
})
