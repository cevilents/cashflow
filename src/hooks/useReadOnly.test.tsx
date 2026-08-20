import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { useCurrentMember, useIsOwnData, useReadOnly } from './useReadOnly'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({
  currentUser: undefined as
    | { id: string }
    | null
    | undefined,
  members: undefined as Member[] | undefined,
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: mocks.currentUser }),
}))

vi.mock('./useMembers', () => ({
  useMembers: () => ({ data: mocks.members }),
}))

const aska: Member = {
  id: 'member-1',
  name: 'Aska',
  email: 'aska@cashflow.local',
  color: '#6366f1',
  icon: 'aska',
  password_set: true,
}

const bima: Member = {
  id: 'member-2',
  name: 'Bima',
  email: 'bima@cashflow.local',
  color: '#10b981',
  icon: 'bima',
  password_set: true,
}

describe('useCurrentMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('returns the member matching the logged-in user id', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useCurrentMember())
    expect(result.current).toEqual(aska)
  })

  it('returns null when the user id matches no member', () => {
    mocks.currentUser = { id: 'unknown' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useCurrentMember())
    expect(result.current).toBeNull()
  })

  it('returns null when there is no user', () => {
    mocks.currentUser = null
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useCurrentMember())
    expect(result.current).toBeNull()
  })

  it('returns null when there are no members', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = undefined
    const { result } = renderHook(() => useCurrentMember())
    expect(result.current).toBeNull()
  })
})

describe('useIsOwnData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('returns true when userId equals the current member id', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useIsOwnData('member-1'))
    expect(result.current).toBe(true)
  })

  it('returns false when userId differs from the current member id', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useIsOwnData('member-2'))
    expect(result.current).toBe(false)
  })

  it('returns false when userId is undefined', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useIsOwnData(undefined))
    expect(result.current).toBe(false)
  })
})

describe('useReadOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it('returns false for own data', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useReadOnly('member-1'))
    expect(result.current).toBe(false)
  })

  it('returns true for another member data', () => {
    mocks.currentUser = { id: 'member-1' }
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useReadOnly('member-2'))
    expect(result.current).toBe(true)
  })

  it('returns true when there is no user', () => {
    mocks.currentUser = null
    mocks.members = [aska, bima]
    const { result } = renderHook(() => useReadOnly('member-1'))
    expect(result.current).toBe(true)
  })
})
