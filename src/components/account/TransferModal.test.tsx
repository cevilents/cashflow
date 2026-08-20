import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../ui/Toast'
import { TransferModal } from './TransferModal'
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

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 100000, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-2', user_id: 'user-1', name: 'BCA', type: 'bank', opening_balance: 50000, color: '#3b82f6', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-3', user_id: 'user-1', name: 'Rekening Lama', type: 'other', opening_balance: 0, color: '#6366f1', is_archived: true, created_at: '2026-01-01T00:00:00Z' },
]

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
        <TransferModal open onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onClose, client, ...view }
}

function form() {
  return document.querySelector('form') as HTMLFormElement
}

async function waitForReady() {
  const select = screen.getByLabelText('Dari akun') as HTMLSelectElement
  await waitFor(() => expect(select.value).toBe('acc-1'))
}

describe('TransferModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.accounts = accounts
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows an error when no destination is selected', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    fireEvent.submit(form())
    expect(screen.getByText('Pilih akun asal dan tujuan')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('excludes the selected source from the destination dropdown and updates it when the source changes', async () => {
    const { onClose } = renderModal()
    await waitForReady()

    const fromSelect = screen.getByLabelText('Dari akun') as HTMLSelectElement
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    let toOptions = Array.from(toSelect.options).map((o) => o.value)
    expect(toOptions).not.toContain('acc-1')
    expect(toOptions).toContain('acc-2')

    fireEvent.change(fromSelect, { target: { value: 'acc-2' } })
    toOptions = Array.from((screen.getByLabelText('Ke akun') as HTMLSelectElement).options).map((o) => o.value)
    expect(toOptions).not.toContain('acc-2')
    expect(toOptions).toContain('acc-1')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('requires a valid positive amount', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    fireEvent.change(screen.getByLabelText('Ke akun'), { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: 'abc' } })
    fireEvent.submit(form())
    expect(screen.getByText('Masukkan jumlah yang valid')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('only lists non-archived accounts and submits a transfer with the correct payload', async () => {
    const { onClose, client } = renderModal()
    await waitForReady()

    const fromSelect = screen.getByLabelText('Dari akun') as HTMLSelectElement
    const toSelect = screen.getByLabelText('Ke akun') as HTMLSelectElement
    expect(fromSelect.value).toBe('acc-1')
    const toOptions = Array.from(toSelect.options).map((o) => o.value)
    expect(toOptions).not.toContain('acc-3')
    expect(toOptions).toContain('acc-2')

    client.setQueryData(['transactions', 'user-1'], [])
    client.setQueryData(['accounts', 'user-1'], accounts)
    mocks.from('transactions').order.mockReturnValue(new Promise(() => {}))
    mocks.from('accounts').order.mockReturnValue(new Promise(() => {}))

    fireEvent.change(toSelect, { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '250000' } })
    fireEvent.change(screen.getByLabelText('Catatan (opsional)'), { target: { value: 'tabungan' } })

    await act(async () => {
      fireEvent.submit(form())
    })

    const tx = mocks.chains['transactions'] as ReturnType<typeof makeQueryChain>
    expect(tx.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc-1',
        type: 'transfer',
        category_id: null,
        to_account_id: 'acc-2',
        amount: 250000,
        note: 'tabungan',
        date: todayISO(),
        receipt_url: null,
        user_id: 'user-1',
      }),
    )
    expect(await screen.findByText('Transfer berhasil')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['accounts', 'user-1'])?.isInvalidated).toBe(true)
  })

  it('surfaces a transfer failure as an Indonesian error toast', async () => {
    const { onClose } = renderModal()
    await waitForReady()
    mocks.from('transactions').insert.mockRejectedValue(new Error('RLS blocked'))

    fireEvent.change(screen.getByLabelText('Ke akun'), { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '10000' } })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(await screen.findByText('RLS blocked')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
