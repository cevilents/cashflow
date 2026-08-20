export type AccountType = 'cash' | 'bank' | 'ewallet' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryType = 'income' | 'expense'
export type Frequency = 'weekly' | 'monthly' | 'yearly'

export interface Profile {
  id: string
  full_name: string
  currency: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  opening_balance: number
  color: string
  is_archived: boolean
  created_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: CategoryType
  icon: string
  color: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  type: TransactionType
  category_id: string | null
  amount: number
  to_account_id: string | null
  note: string
  date: string
  receipt_url: string | null
  created_at: string
  updated_at: string
}

export interface RecurringTransaction {
  id: string
  user_id: string
  name: string
  account_id: string
  category_id: string | null
  type: Exclude<TransactionType, 'transfer'>
  amount: number
  frequency: Frequency
  next_due_date: string
  is_active: boolean
  created_at: string
}