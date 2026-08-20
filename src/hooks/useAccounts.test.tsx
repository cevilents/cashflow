import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from './useAccounts'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'
import type { Account } from '../types/database'

const auth = vi.hoisted(() => ({ id: 'user-1' as string }))
const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: auth.id ? { id: auth.id } : null }),
}))

const account: Account = {
  id: 'acc-1',
  user_id: 'user-1',
  name: 'Bank',
  type: 'bank',
  opening_balance: 1000,
  color: '#10b981',
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
}

const createInput = { name: 'Bank', type: 'bank' as const, opening_balance: 0, color: '#10b981' }

describe('useAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('fetches accounts sorted by created_at ascending', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [account], error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useAccounts)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('accounts')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result.current.data).toEqual([account])
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: null, error: { message: 'supabase down' } })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useAccounts)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('supabase down')
  })

  it('stays pending while there is no signed-in user', () => {
    auth.id = ''
    const chain = makeQueryChain()
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useAccounts)

    expect(result.current.status).toBe('pending')
    expect(result.current.fetchStatus).toBe('idle')
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('useCreateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('inserts with the current user id', async () => {
    const chain = makeQueryChain()
    chain.insert.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useCreateAccount)

    await act(async () => {
      await result.current.mutateAsync(createInput)
    })
    expect(mocks.from).toHaveBeenCalledWith('accounts')
    expect(chain.insert).toHaveBeenCalledWith({ ...createInput, user_id: 'user-1' })
  })

  it('invalidates accounts and transactions on success', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [], error: null })
    chain.insert.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result, client } = renderQueryHook(() => ({
      accounts: useAccounts(),
      create: useCreateAccount(),
    }))
    await waitFor(() => expect(result.current.accounts.isSuccess).toBe(true))
    expect(chain.order).toHaveBeenCalledTimes(1)

    client.setQueryData(['transactions', 'user-1'], [])
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(false)

    await act(async () => {
      await result.current.create.mutateAsync(createInput)
    })

    await waitFor(() => expect(chain.order).toHaveBeenCalledTimes(2))
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(true)
  })

  it('throws when there is no signed-in user', async () => {
    auth.id = ''
    const chain = makeQueryChain()
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useCreateAccount)

    await expect(
      act(async () => {
        await result.current.mutateAsync(createInput)
      }),
    ).rejects.toThrow('Not authenticated')
    expect(chain.insert).not.toHaveBeenCalled()
  })
})

describe('useUpdateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('updates by id and invalidates accounts, transactions, and recurring', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [], error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result, client } = renderQueryHook(() => {
      const accounts = useAccounts()
      const update = useUpdateAccount()
      return { accounts, update }
    })
    await waitFor(() => expect(result.current.accounts.isSuccess).toBe(true))
    expect(chain.order).toHaveBeenCalledTimes(1)

    client.setQueryData(['transactions', 'user-1'], [])
    client.setQueryData(['recurring', 'user-1'], [])

    await act(async () => {
      await result.current.update.mutateAsync({ id: 'acc-1', name: 'Bank Baru' })
    })

    expect(mocks.from).toHaveBeenCalledWith('accounts')
    expect(chain.update).toHaveBeenCalledWith({ name: 'Bank Baru' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'acc-1')
    await waitFor(() => expect(chain.order).toHaveBeenCalledTimes(2))
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['recurring', 'user-1'])?.isInvalidated).toBe(true)
  })
})

describe('useDeleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('deletes by id and invalidates accounts, transactions, and recurring', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [], error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result, client } = renderQueryHook(() => {
      const accounts = useAccounts()
      const remove = useDeleteAccount()
      return { accounts, remove }
    })
    await waitFor(() => expect(result.current.accounts.isSuccess).toBe(true))
    expect(chain.order).toHaveBeenCalledTimes(1)

    client.setQueryData(['transactions', 'user-1'], [])
    client.setQueryData(['recurring', 'user-1'], [])

    await act(async () => {
      await result.current.remove.mutateAsync('acc-1')
    })

    expect(mocks.from).toHaveBeenCalledWith('accounts')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'acc-1')
    await waitFor(() => expect(chain.order).toHaveBeenCalledTimes(2))
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['recurring', 'user-1'])?.isInvalidated).toBe(true)
  })
})