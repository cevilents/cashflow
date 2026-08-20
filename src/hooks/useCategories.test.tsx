import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { useCategories, useUpdateCategory, useDeleteCategory } from './useCategories'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'
import type { Category } from '../types/database'

const auth = vi.hoisted(() => ({ id: 'user-1' as string }))
const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: auth.id ? { id: auth.id } : null }),
}))

const category: Category = {
  id: 'cat-1',
  user_id: 'user-1',
  name: 'Makan',
  type: 'expense',
  icon: 'tag',
  color: '#6366f1',
  created_at: '2026-01-01T00:00:00Z',
}

describe('useCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('fetches categories sorted by created_at ascending', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [category], error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useCategories)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('categories')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(result.current.data).toEqual([category])
  })
})

describe('useUpdateCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('updates by id and invalidates categories, transactions, and recurring', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [], error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result, client } = renderQueryHook(() => {
      const categories = useCategories()
      const update = useUpdateCategory()
      return { categories, update }
    })
    await waitFor(() => expect(result.current.categories.isSuccess).toBe(true))
    expect(chain.order).toHaveBeenCalledTimes(1)

    client.setQueryData(['transactions', 'user-1'], [])
    client.setQueryData(['recurring', 'user-1'], [])

    await act(async () => {
      await result.current.update.mutateAsync({ id: 'cat-1', name: 'Kuliner' })
    })

    expect(mocks.from).toHaveBeenCalledWith('categories')
    expect(chain.update).toHaveBeenCalledWith({ name: 'Kuliner' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'cat-1')
    await waitFor(() => expect(chain.order).toHaveBeenCalledTimes(2))
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['recurring', 'user-1'])?.isInvalidated).toBe(true)
  })
})

describe('useDeleteCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.id = 'user-1'
  })
  afterEach(cleanup)

  it('deletes by id and invalidates categories, transactions, and recurring', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [], error: null })
    chain.eq.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result, client } = renderQueryHook(() => {
      const categories = useCategories()
      const remove = useDeleteCategory()
      return { categories, remove }
    })
    await waitFor(() => expect(result.current.categories.isSuccess).toBe(true))
    expect(chain.order).toHaveBeenCalledTimes(1)

    client.setQueryData(['transactions', 'user-1'], [])
    client.setQueryData(['recurring', 'user-1'], [])

    await act(async () => {
      await result.current.remove.mutateAsync('cat-1')
    })

    expect(mocks.from).toHaveBeenCalledWith('categories')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'cat-1')
    await waitFor(() => expect(chain.order).toHaveBeenCalledTimes(2))
    expect(client.getQueryState(['transactions', 'user-1'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['recurring', 'user-1'])?.isInvalidated).toBe(true)
  })
})