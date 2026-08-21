import type { Account } from '../types/database'

export function isFundingAccount(a: Pick<Account, 'type'>): boolean {
  return a.type === 'funding'
}

export function isSpendableAccount(a: Pick<Account, 'type'>): boolean {
  return a.type !== 'funding'
}
