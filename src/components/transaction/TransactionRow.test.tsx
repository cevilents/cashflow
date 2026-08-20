import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TransactionRow } from './TransactionRow'
import { formatDay } from '../../lib/dates'
import type { Account, Transaction } from '../../types/database'

const mocks = vi.hoisted(() => ({ receiptUrl: vi.fn() }))

vi.mock('../receipt/receiptStorage', () => ({
  receiptUrl: mocks.receiptUrl,
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

const toAccount: Account = { ...account, id: 'acc-2', name: 'BCA', type: 'bank' }

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    type: 'expense',
    category_id: 'cat-1',
    amount: 50000,
    to_account_id: null,
    note: '',
    date: '2026-08-01',
    receipt_url: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('TransactionRow', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('renders an expense with a negative amount, category, account, and date', () => {
    render(
      <TransactionRow
        tx={tx({ category_id: 'cat-1' })}
        account={account}
        category={{ id: 'cat-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'rice', color: '#ef4444', created_at: '' }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Makanan')).toBeInTheDocument()
    expect(screen.getByText('-Rp 50.000')).toBeInTheDocument()
    expect(screen.getByText('Tunai')).toBeInTheDocument()
    expect(screen.getByText(formatDay('2026-08-01'))).toBeInTheDocument()
  })

  it('renders an income with a plus sign', () => {
    render(
      <TransactionRow
        tx={tx({ type: 'income', amount: 100000 })}
        account={account}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('+Rp 100.000')).toBeInTheDocument()
  })

  it('shows both accounts for a transfer', () => {
    render(
      <TransactionRow
        tx={tx({ type: 'transfer', to_account_id: 'acc-2' })}
        account={account}
        toAccount={toAccount}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Tunai → BCA')).toBeInTheDocument()
  })

  it('falls back to the note text when there is no category', () => {
    render(
      <TransactionRow
        tx={tx({ category_id: null, note: 'Pulsa' })}
        account={account}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Pulsa')).toBeInTheDocument()
  })

  it('calls onEdit and onDelete with the transaction', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const row = tx({})
    render(<TransactionRow tx={row} account={account} onEdit={onEdit} onDelete={onDelete} />)

    fireEvent.click(screen.getByLabelText('Edit'))
    fireEvent.click(screen.getByLabelText('Hapus'))

    expect(onEdit).toHaveBeenCalledWith(row)
    expect(onDelete).toHaveBeenCalledWith(row)
  })

  it('opens the receipt lightbox from the attachment button', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/signed.png')
    render(
      <TransactionRow
        tx={tx({ receipt_url: 'user-1/tx-1/a.png' })}
        account={account}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByLabelText('Lihat bukti'))

    expect(await screen.findByAltText('Bukti transaksi')).toHaveAttribute('src', 'https://cdn/signed.png')
  })

  it('does not show the attachment button without a receipt', () => {
    render(<TransactionRow tx={tx({})} account={account} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByLabelText('Lihat bukti')).not.toBeInTheDocument()
  })
})
