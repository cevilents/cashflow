import { describe, it, expect } from 'vitest'
import { computeAccountBalances, totalBalance } from './balances'
import type { Account, Transaction } from '../types/database'

const acc = (id: string, opening = 0): Account => ({
  id, user_id: 'u', name: id, type: 'cash', opening_balance: opening,
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