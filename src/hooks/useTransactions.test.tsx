import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { useTransactions, useCreateTransaction, useDeleteTransaction } from './useTransactions'
import type { TransactionInput } from './useTransactions'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'
import type { Transaction } from '../types/database'

const auth = vi.hoisted(() => ({ id: 'user-1' as string }))
const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: auth.id ? { id: auth.id } : null }),
}))

const transaction: Transaction = {
  id: 'tx-1',
  user_id: 'user-1',
  account_id: 'acc-1',
  type: 'income',
  category_id: null,
  amount: 100000,
  to_account_id: null,
  note: '',
  date: '2026-08-01',
  receipt_url: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

const txInput: TransactionInput = {
  account_id: 'acc-1',
  type: 'income',
  category_id: null,
  amount: 100000,
  to_account_id: null,
  note: '',
  date: '2026-08-01',
  receipt_url: null,
}

describe('useTransactions', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('fetches transactions sorted by date then created_at descending', async () => {
    const chain = makeQueryChain()
    chain.order.mockImplementation((col: unknown) =>
      col === 'created_at' ? Promise.resolve({ data: [transaction], error: null }) : chain,
    )
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useTransactions)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('transactions')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenNthCalledWith(1, 'date', { ascending: false })
    expect(chain.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(result.current.data).toEqual([transaction])
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain()
    chain.order.mockImplementation((col: unknown) =>
      col === 'created_at' ? Promise.resolve({ data: null, error: { message: 'boom' } }) : chain,
    )
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useTransactions)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('boom')
  })
})

describe('useCreateTransaction', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('inserts a transaction with the current user id', async () => {
    const chain = makeQueryChain()
    chain.insert.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useCreateTransaction)

    await act(async () => {
      await result.current.mutateAsync(txInput)
    })
    expect(mocks.from).toHaveBeenCalledWith('transactions')
    expect(chain.insert).toHaveBeenCalledWith({ ...txInput, user_id: 'user-1' })
  })
})

describe('useDeleteTransaction', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('deletes by id and invalidates transactions and accounts', async () => {
    const chain = makeQueryChain()
    chain.order.mockImplementation((col: unknown) =>
      col === 'created_at' ? Promise.resolve({ data: [], error: null }) : chain,
    )
    chain.eq.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result, client } = renderQueryHook(() => ({
      transactions: useTransactions(),
      remove: useDeleteTransaction(),
    }))
    await waitFor(() => expect(result.current.transactions.isSuccess).toBe(true))
    expect(chain.order).toHaveBeenCalledTimes(2)

    client.setQueryData(['accounts', 'user-1'], [])
    await act(async () => {
      await result.current.remove.mutateAsync('tx-1')
    })

    expect(mocks.from).toHaveBeenCalledWith('transactions')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'tx-1')
    await waitFor(() => expect(chain.order).toHaveBeenCalledTimes(4))
    expect(client.getQueryState(['accounts', 'user-1'])?.isInvalidated).toBe(true)
  })
})