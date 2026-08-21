import { describe, it, expect } from 'vitest'
import { isFundingAccount, isSpendableAccount } from './accounts'
import type { Account } from '../types/database'

const account = (type: Account['type']): Account => ({
  id: 'a', user_id: 'u', name: 'a', type, opening_balance: 0,
  color: '#000', is_archived: false, created_at: '',
})

describe('account type helpers', () => {
  it('isFundingAccount is true only for funding type', () => {
    expect(isFundingAccount(account('funding'))).toBe(true)
    expect(isFundingAccount(account('bank'))).toBe(false)
    expect(isFundingAccount(account('cash'))).toBe(false)
    expect(isFundingAccount(account('ewallet'))).toBe(false)
    expect(isFundingAccount(account('other'))).toBe(false)
  })

  it('isSpendableAccount is true for non-funding types', () => {
    expect(isSpendableAccount(account('bank'))).toBe(true)
    expect(isSpendableAccount(account('cash'))).toBe(true)
    expect(isSpendableAccount(account('ewallet'))).toBe(true)
    expect(isSpendableAccount(account('other'))).toBe(true)
    expect(isSpendableAccount(account('funding'))).toBe(false)
  })
})
