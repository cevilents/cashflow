import type { Account, Transaction } from '../types/database'

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const acc of accounts) balances[acc.id] = Number(acc.opening_balance) || 0
  for (const t of transactions) {
    const amount = Number(t.amount) || 0
    if (t.type === 'income') {
      balances[t.account_id] = (balances[t.account_id] ?? 0) + amount
    } else if (t.type === 'expense') {
      balances[t.account_id] = (balances[t.account_id] ?? 0) - amount
    } else {
      balances[t.account_id] = (balances[t.account_id] ?? 0) - amount
      if (t.to_account_id) balances[t.to_account_id] = (balances[t.to_account_id] ?? 0) + amount
    }
  }
  return balances
}

export function totalBalance(balances: Record<string, number>): number {
  return Object.values(balances).reduce((sum, v) => sum + v, 0)
}