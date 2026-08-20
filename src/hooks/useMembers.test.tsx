import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, waitFor } from '@testing-library/react'
import { useMembers, useIsSetupComplete } from './useMembers'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

const member: Member = {
  id: 'member-1',
  name: 'Bima',
  email: 'bima@example.com',
  color: '#10b981',
  icon: 'face',
}

describe('useMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('fetches members sorted by name ascending', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: [member], error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useMembers)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('members')
    expect(chain.select).toHaveBeenCalledWith('id, name, email, color, icon')
    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true })
    expect(result.current.data).toEqual([member])
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain()
    chain.order.mockResolvedValue({ data: null, error: { message: 'supabase down' } })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useMembers)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('supabase down')
  })
})

describe('useIsSetupComplete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('returns true when setup_complete is true', async () => {
    const chain = makeQueryChain()
    chain.maybeSingle.mockResolvedValue({ data: { setup_complete: true }, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useIsSetupComplete)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('app_settings')
    expect(chain.eq).toHaveBeenCalledWith('id', 1)
    expect(result.current.data).toBe(true)
  })

  it('returns false when setup_complete is null', async () => {
    const chain = makeQueryChain()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useIsSetupComplete)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(chain.maybeSingle).toHaveBeenCalled()
    expect(result.current.data).toBe(false)
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain()
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'supabase down' } })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useIsSetupComplete)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('supabase down')
  })
})
