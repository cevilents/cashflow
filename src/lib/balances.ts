import type { Account, Transaction } from '../types/database'
import { isFundingAccount } from './accounts'

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

export function spendableTotalBalance(balances: Record<string, number>, accounts: Account[]): number {
  return accounts
    .filter((a) => !isFundingAccount(a))
    .reduce((sum, a) => sum + (balances[a.id] ?? 0), 0)
}

export function totalFundingBalance(balances: Record<string, number>, accounts: Account[]): number {
  return accounts
    .filter((a) => isFundingAccount(a))
    .reduce((sum, a) => sum + (balances[a.id] ?? 0), 0)
}

export function totalBalanceByMember(
  balances: Record<string, number>,
  accounts: Account[],
  members: { id: string; name: string; color: string }[],
) {
  const totals = new Map<string, number>()
  for (const acc of accounts) {
    totals.set(acc.user_id, (totals.get(acc.user_id) ?? 0) + (balances[acc.id] ?? 0))
  }
  return members.map((m) => ({
    memberId: m.id,
    name: m.name,
    color: m.color,
    total: totals.get(m.id) ?? 0,
  }))
}