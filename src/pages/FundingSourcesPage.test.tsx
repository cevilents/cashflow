import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('hides action buttons for funding sources owned by another member', async () => {
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

    const ownCard = screen.getByText('IB HFM').closest('div.rounded-2xl') as HTMLElement
    expect(within(ownCard).getByRole('button', { name: 'Transfer' })).toBeInTheDocument()
    expect(within(ownCard).getByRole('button', { name: 'Ubah' })).toBeInTheDocument()
    expect(within(ownCard).getByRole('button', { name: 'Arsipkan' })).toBeInTheDocument()
    expect(within(ownCard).getByRole('button', { name: 'Hapus' })).toBeInTheDocument()

    const foreignCard = screen.getByText('LYNK').closest('div.rounded-2xl') as HTMLElement
    expect(within(foreignCard).queryByRole('button', { name: 'Transfer' })).not.toBeInTheDocument()
    expect(within(foreignCard).queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument()
    expect(within(foreignCard).queryByRole('button', { name: 'Arsipkan' })).not.toBeInTheDocument()
    expect(within(foreignCard).queryByRole('button', { name: 'Hapus' })).not.toBeInTheDocument()
  })
})
