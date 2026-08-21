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

async function waitForReady() {
  await waitFor(() => {
    const select = screen.getByLabelText('Ke akun') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(Array.from(select.options).some((o) => o.value === 'acc-2')).toBe(true)
  })
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
    await waitForReady()
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    const toOptions = Array.from(toSelect.options).map((o) => o.value)
    expect(toOptions).toContain('acc-2')
    expect(toOptions).not.toContain('fund-1')
  })

  it('requires a valid amount', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    fireEvent.change(toSelect, { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: 'abc' } })
    fireEvent.submit(form())
    expect(await screen.findByText('Masukkan jumlah yang valid')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('creates a transfer transaction from the funding source to the bank', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
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
