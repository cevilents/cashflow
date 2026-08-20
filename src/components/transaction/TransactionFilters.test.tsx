import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TransactionFilters, emptyFilters } from './TransactionFilters'
import type { TxFiltersValue } from './TransactionFilters'
import type { Account, Category } from '../../types/database'

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'u', name: 'Tunai', type: 'cash', opening_balance: 0, color: '#10b981', is_archived: false, created_at: '' },
  { id: 'acc-2', user_id: 'u', name: 'BCA', type: 'bank', opening_balance: 0, color: '#3b82f6', is_archived: false, created_at: '' },
]

const categories: Category[] = [
  { id: 'cat-1', user_id: 'u', name: 'Makanan', type: 'expense', icon: 'rice', color: '#ef4444', created_at: '' },
]

function renderFilters(value: TxFiltersValue = emptyFilters, onChange = vi.fn()) {
  render(<TransactionFilters value={value} onChange={onChange} accounts={accounts} categories={categories} />)
  return onChange
}

describe('TransactionFilters', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('updates the search text', () => {
    const onChange = renderFilters()
    fireEvent.change(screen.getByLabelText('Cari'), { target: { value: 'kopi' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, search: 'kopi' })
  })

  it('updates the type filter', () => {
    const onChange = renderFilters()
    fireEvent.change(screen.getByLabelText('Tipe transaksi'), { target: { value: 'income' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, type: 'income' })
  })

  it('updates the account filter', () => {
    const onChange = renderFilters()
    fireEvent.change(screen.getByLabelText('Akun'), { target: { value: 'acc-2' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, accountId: 'acc-2' })
  })

  it('updates the category filter', () => {
    const onChange = renderFilters()
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-1' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, categoryId: 'cat-1' })
  })

  it('updates each date range input independently', () => {
    const onChange = renderFilters()
    fireEvent.change(screen.getByLabelText('Dari tanggal'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Sampai tanggal'), { target: { value: '2026-08-31' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, from: '2026-08-01' })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, to: '2026-08-31' })
  })

  it('merges a single patch without dropping existing values', () => {
    const onChange = renderFilters({ ...emptyFilters, search: 'kopi' })
    fireEvent.change(screen.getByLabelText('Tipe transaksi'), { target: { value: 'expense' } })
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, search: 'kopi', type: 'expense' })
  })
})
