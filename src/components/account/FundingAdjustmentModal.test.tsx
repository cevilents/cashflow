import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../ui/Toast'
import { FundingAdjustmentModal } from './FundingAdjustmentModal'
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

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'funding_transactions') {
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
        <FundingAdjustmentModal open onClose={onClose} source={source} />
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
    expect(screen.getByLabelText('Jenis')).toHaveValue('topup')
  })
}

describe('FundingAdjustmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.accounts = [source]
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('submits a top-up with positive amount and default today date', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '250000' } })
    await act(async () => { fireEvent.submit(form()) })
    const ft = mocks.chains['funding_transactions']
    expect(ft?.insert).toHaveBeenCalledWith(expect.objectContaining({
      account_id: 'fund-1',
      amount: 250000,
      date: todayISO(),
      note: '',
    }))
    expect(await screen.findByText('Penyesuaian disimpan')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('submits a withdrawal with negative amount', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    fireEvent.change(screen.getByLabelText('Jenis'), { target: { value: 'withdraw' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '120000' } })
    await act(async () => { fireEvent.submit(form()) })
    const ft = mocks.chains['funding_transactions']
    expect(ft?.insert).toHaveBeenCalledWith(expect.objectContaining({ account_id: 'fund-1', amount: -120000 }))
    expect(await screen.findByText('Penyesuaian disimpan')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('requires a valid amount', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    fireEvent.submit(form())
    expect(await screen.findByText('Masukkan jumlah yang valid')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
