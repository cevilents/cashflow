import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { useFundingTransactions, useCreateFundingTransaction } from './useFundingTransactions'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'

const auth = vi.hoisted(() => ({ id: 'user-1' as string }))
const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: auth.id ? { id: auth.id } : null }),
}))

const createInput = { account_id: 'fund-1', amount: 500, date: '2026-08-21', note: 'top up' }

describe('useFundingTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('fetches funding transactions sorted by date then created_at descending', async () => {
    const chain = makeQueryChain()
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useFundingTransactions)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('funding_transactions')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result.current.data).toEqual([])
  })
})

describe('useCreateFundingTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('passes create input to insert', async () => {
    const chain = makeQueryChain()
    chain.insert.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(() => ({
      funding: useFundingTransactions(),
      create: useCreateFundingTransaction(),
    }))
    await waitFor(() => expect(result.current.funding.isSuccess).toBe(true))

    await act(async () => {
      await result.current.create.mutateAsync(createInput)
    })
    expect(mocks.from).toHaveBeenCalledWith('funding_transactions')
    expect(chain.insert).toHaveBeenCalledWith(createInput)
    expect(chain.insert).toHaveBeenCalledWith({ account_id: 'fund-1', amount: 500, date: '2026-08-21', note: 'top up' })
  })

  it('throws when there is no signed-in user', async () => {
    auth.id = ''
    const chain = makeQueryChain()
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useCreateFundingTransaction)

    await expect(
      act(async () => {
        await result.current.mutateAsync(createInput)
      }),
    ).rejects.toThrow('Not authenticated')
    expect(chain.insert).not.toHaveBeenCalled()
  })
})
