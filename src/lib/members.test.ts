import { describe, expect, it } from 'vitest'
import {
  getMemberByEmail,
  getMemberById,
  memberInitials,
  MEMBER_SLOTS,
} from './members'

describe('members', () => {
  it('maps known emails to slots', () => {
    expect(getMemberByEmail('bima@cashflow.local')?.name).toBe('Bima')
    expect(getMemberByEmail('aska@cashflow.local')?.name).toBe('Aska')
    expect(getMemberByEmail('nanda@cashflow.local')?.name).toBe('Nanda')
  })

  it('returns null for unknown email', () => {
    expect(getMemberByEmail('x@y.z')).toBeNull()
    expect(getMemberByEmail(undefined)).toBeNull()
  })

  it('resolves a member by id', () => {
    const members = MEMBER_SLOTS.map((s, i) => ({ id: String(i), ...s }))
    expect(getMemberById('1', members)?.name).toBe('Aska')
    expect(getMemberById('nope', members)).toBeUndefined()
    expect(getMemberById(undefined, members)).toBeUndefined()
  })

  it('computes initials', () => {
    expect(memberInitials('Bima')).toBe('BI')
  })
})
