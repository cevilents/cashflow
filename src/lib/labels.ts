import type { AccountType } from '../types/database'

export const accountTypeLabels: Record<AccountType, string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-wallet',
  other: 'Lainnya',
  funding: 'Sumber Dana',
}
