import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { useRecurring, useCreateRecurring } from './useRecurring'
import type { RecurringInput } from './useRecurring'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'
import type { RecurringTransaction } from '../types/database'

const auth = vi.hoisted(() => ({ id: 'user-1' as string }))
const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: auth.id ? { id: auth.id } : null }),
}))

const recurring: RecurringTransaction = {
  id: 'rec-1',
  user_id: 'user-1',
  name: 'Gaji',
  account_id: 'acc-1',
  category_id: null,
  type: 'income',
  amount: 5000000,
  frequency: 'monthly',
  next_due_date: '2026-09-01',
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
}

const recInput: RecurringInput = {
  name: 'Gaji',
  account_id: 'acc-1',
  category_id: null,
  type: 'income',
  amount: 5000000,
  frequency: 'monthly',
  next_due_date: '2026-09-01',
  is_active: true,
}

describe('useRecurring', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('fetches recurring transactions sorted by next_due_date ascending', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [recurring], error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useRecurring)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('recurring_transactions')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('next_due_date', { ascending: true })
    expect(result.current.data).toEqual([recurring])
  })
})

describe('useCreateRecurring', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('inserts a recurring transaction with the current user id', async () => {
    const chain = makeQueryChain()
    chain.insert.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useCreateRecurring)

    await act(async () => {
      await result.current.mutateAsync(recInput)
    })
    expect(mocks.from).toHaveBeenCalledWith('recurring_transactions')
    expect(chain.insert).toHaveBeenCalledWith({ ...recInput, user_id: 'user-1' })
  })
})