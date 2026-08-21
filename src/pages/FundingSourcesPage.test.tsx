import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import FundingSourcesPage from './FundingSourcesPage'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import { todayISO } from '../lib/dates'
import type { Account, Transaction, FundingTransaction } from '../types/database'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  accounts: [] as Account[],
  transactions: [] as Transaction[],
  fundingTransactions: [] as FundingTransaction[],
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
      if (table === 'funding_transactions') {
        ;(chain as unknown as { data: FundingTransaction[] }).data = mocks.fundingTransactions
        chain.insert.mockResolvedValue({ error: null })
      } else if (table === 'accounts') {
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

function cardFor(name: string): HTMLElement {
  return screen.getByText(name).closest('div.rounded-2xl') as HTMLElement
}

describe('FundingSourcesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
    ]
    mocks.fundingTransactions = []
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
    fireEvent.click(within(cardFor('IB HFM')).getByRole('button', { name: 'Transfer' }))
    expect(await screen.findByText('Transfer dari Sumber Dana')).toBeInTheDocument()
  })

  it('shows action buttons for every funding source regardless of owner', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: true },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska', password_set: true },
    ]
    mocks.accounts = [
      { id: 'own-fund', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 100000, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
      { id: 'foreign-fund', user_id: 'user-2', name: 'LYNK', type: 'funding', opening_balance: 50000, color: '#ccc', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()
    await screen.findByText('IB HFM')

    const foreignCard = cardFor('LYNK')
    expect(within(foreignCard).getByRole('button', { name: 'Penyesuaian' })).toBeInTheDocument()
    expect(within(foreignCard).getByRole('button', { name: 'Transfer' })).toBeInTheDocument()
    expect(within(foreignCard).getByRole('button', { name: 'Ubah' })).toBeInTheDocument()
    expect(within(foreignCard).getByRole('button', { name: 'Arsipkan' })).toBeInTheDocument()
    expect(within(foreignCard).getByRole('button', { name: 'Hapus' })).toBeInTheDocument()
  })

  it('opens the adjustment modal from a source card and submits a top-up', async () => {
    mocks.accounts = [funding]
    renderPage()
    await screen.findByText('IB HFM')
    fireEvent.click(within(cardFor('IB HFM')).getByRole('button', { name: 'Penyesuaian' }))
    expect(await screen.findByText('Penyesuaian Saldo')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '250000' } })
    await act(async () => {
      fireEvent.submit(document.querySelector('form') as HTMLFormElement)
    })
    const ft = mocks.chains['funding_transactions']
    expect(ft?.insert).toHaveBeenCalledWith(expect.objectContaining({
      account_id: 'fund-1',
      amount: 250000,
      date: todayISO(),
      note: '',
    }))
    expect(await screen.findByText('Penyesuaian disimpan')).toBeInTheDocument()
  })

  it('shows recent funding adjustments as history on the card', async () => {
    mocks.accounts = [funding]
    mocks.fundingTransactions = [
      { id: 'f1', account_id: 'fund-1', amount: 250000, date: '2026-03-01', note: 'top up', created_at: '2026-03-01T00:00:00Z' },
      { id: 'f2', account_id: 'fund-1', amount: -100000, date: '2026-02-15', note: 'withdraw', created_at: '2026-02-15T00:00:00Z' },
    ]
    renderPage()
    await screen.findByText('IB HFM')
    const card = cardFor('IB HFM')
    expect(within(card).getByText('2026-03-01')).toBeInTheDocument()
    expect(within(card).getByText('+Rp 250.000')).toBeInTheDocument()
    expect(within(card).getByText('2026-02-15')).toBeInTheDocument()
    expect(within(card).getByText('-Rp 100.000')).toBeInTheDocument()
  })
})
