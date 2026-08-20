import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import { useProfile, useUpdateProfile } from './useProfile'
import { makeQueryChain, renderQueryHook } from '../test/queryTestUtils'
import type { Profile } from '../types/database'

const auth = vi.hoisted(() => ({ id: 'user-1' as string }))
const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: auth.id ? { id: auth.id } : null }),
}))

const profile: Profile = {
  id: 'user-1',
  full_name: 'Budi',
  currency: 'IDR',
  created_at: '2026-01-01T00:00:00Z',
}

describe('useProfile', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('fetches the signed-in profile by user id', async () => {
    const chain = makeQueryChain()
    chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useProfile)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('id', 'user-1')
    expect(chain.maybeSingle).toHaveBeenCalled()
    expect(result.current.data).toEqual(profile)
  })

  it('returns null when the profile does not exist yet', async () => {
    const chain = makeQueryChain()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(useProfile)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe('useUpdateProfile', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('updates the profile and invalidates the profile query', async () => {
    const chain = makeQueryChain()
    chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
    let eqCalls = 0
    chain.eq.mockImplementation(() => {
      eqCalls += 1
      return eqCalls % 2 === 0 ? Promise.resolve({ data: null, error: null }) : chain
    })
    mocks.from.mockReturnValue(chain)

    const { result } = renderQueryHook(() => ({
      profile: useProfile(),
      update: useUpdateProfile(),
    }))
    await waitFor(() => expect(result.current.profile.isSuccess).toBe(true))
    expect(chain.maybeSingle).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.update.mutateAsync({ full_name: 'Budi', currency: 'IDR' })
    })

    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(chain.update).toHaveBeenCalledWith({ full_name: 'Budi', currency: 'IDR' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'user-1')
    await waitFor(() => expect(chain.maybeSingle).toHaveBeenCalledTimes(2))
  })
})