import { describe, it, expect } from 'vitest'
import { computeAccountBalances, totalBalance, totalBalanceByMember, spendableTotalBalance, totalFundingBalance } from './balances'
import type { Account, Transaction } from '../types/database'

const acc = (id: string, opening = 0, userId = 'u'): Account => ({
  id, user_id: userId, name: id, type: 'cash', opening_balance: opening,
  color: '#000', is_archived: false, created_at: '',
})
const tx = (partial: Partial<Transaction>): Transaction => ({
  id: partial.id ?? 't', user_id: 'u', account_id: partial.account_id ?? 'a',
  type: partial.type!, category_id: null, amount: partial.amount ?? 0,
  to_account_id: partial.to_account_id ?? null, note: '', date: '2026-08-01',
  receipt_url: null, created_at: '', updated_at: '',
})

describe('computeAccountBalances', () => {
  it('starts from opening balance', () => {
    const r = computeAccountBalances([acc('a', 1000)], [])
    expect(r['a']).toBe(1000)
  })
  it('adds income, subtracts expense', () => {
    const accounts = [acc('a', 1000)]
    const transactions = [
      tx({ id: '1', account_id: 'a', type: 'income', amount: 500 }),
      tx({ id: '2', account_id: 'a', type: 'expense', amount: 200 }),
    ]
    expect(computeAccountBalances(accounts, transactions)['a']).toBe(1300)
  })
  it('transfer debits source and credits destination', () => {
    const accounts = [acc('a', 1000), acc('b', 0)]
    const transactions = [
      tx({ id: '1', account_id: 'a', type: 'transfer', amount: 300, to_account_id: 'b' }),
    ]
    const r = computeAccountBalances(accounts, transactions)
    expect(r['a']).toBe(700)
    expect(r['b']).toBe(300)
  })
  it('does not double count transfer source', () => {
    const accounts = [acc('a', 1000)]
    const transactions = [tx({ id: '1', account_id: 'a', type: 'transfer', amount: 300, to_account_id: 'x' })]
    expect(computeAccountBalances(accounts, transactions)['a']).toBe(700)
  })
})

describe('totalBalance', () => {
  it('sums all balances', () => {
    expect(totalBalance({ a: 100, b: -30 })).toBe(70)
  })
})

describe('totalBalanceByMember', () => {
  it('groups account balances by member and returns member rows', () => {
    const accounts = [acc('acc-a', 100, 'a'), acc('acc-b', 50, 'b')]
    const balances = computeAccountBalances(accounts, [])
    const members = [
      { id: 'a', name: 'Bima', color: '#10b981' },
      { id: 'b', name: 'Aska', color: '#6366f1' },
    ]
    const result = totalBalanceByMember(balances, accounts, members)
    expect(result).toEqual([
      { memberId: 'a', name: 'Bima', color: '#10b981', total: 100 },
      { memberId: 'b', name: 'Aska', color: '#6366f1', total: 50 },
    ])
    expect(result.reduce((sum, r) => sum + r.total, 0)).toBe(totalBalance(balances))
  })
  it('returns zero for members without accounts', () => {
    const accounts = [acc('acc-a', 100, 'a')]
    const balances = computeAccountBalances(accounts, [])
    const members = [{ id: 'a', name: 'Bima', color: '#10b981' }, { id: 'c', name: 'Nanda', color: '#f59e0b' }]
    const result = totalBalanceByMember(balances, accounts, members)
    expect(result.find((r) => r.memberId === 'a')?.total).toBe(100)
    expect(result.find((r) => r.memberId === 'c')?.total).toBe(0)
  })
})

describe('spendableTotalBalance', () => {
  it('excludes funding accounts from the global total', () => {
    const accounts = [
      { ...acc('cash-a', 100), type: 'cash' as const },
      { ...acc('fund-a', 500), type: 'funding' as const },
    ]
    const balances = computeAccountBalances(accounts, [])
    expect(spendableTotalBalance(balances, accounts)).toBe(100)
    expect(totalFundingBalance(balances, accounts)).toBe(500)
    expect(totalBalance(balances)).toBe(600)
  })
})