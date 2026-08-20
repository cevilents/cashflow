import type { SupabaseClient } from '@supabase/supabase-js'
import type { Account, Category, RecurringTransaction, Transaction } from '../types/database'

export const BACKUP_VERSION = 1

export interface BackupFile {
  format_version: number
  user_id: string
  exported_at: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurring: RecurringTransaction[]
}

export function buildBackup(input: {
  userId: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  recurring: RecurringTransaction[]
}): BackupFile {
  return {
    format_version: BACKUP_VERSION,
    user_id: input.userId,
    exported_at: new Date().toISOString(),
    accounts: [...input.accounts],
    categories: [...input.categories],
    transactions: [...input.transactions],
    recurring: [...input.recurring],
  }
}

export type BackupParseError = 'invalid-json' | 'invalid-structure' | 'invalid-version'

export type BackupParseResult = { ok: true; data: BackupFile } | { ok: false; error: BackupParseError }

export const PARSE_ERROR_MESSAGES: Record<BackupParseError, string> = {
  'invalid-json': 'File JSON tidak valid',
  'invalid-structure': 'Struktur backup tidak dikenali',
  'invalid-version': 'Versi backup tidak didukung',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function parseBackup(text: string): BackupParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }

  if (!isRecord(parsed)) return { ok: false, error: 'invalid-structure' }
  if (parsed.format_version !== BACKUP_VERSION) return { ok: false, error: 'invalid-version' }
  if (typeof parsed.user_id !== 'string' || parsed.user_id.length === 0) {
    return { ok: false, error: 'invalid-structure' }
  }

  return {
    ok: true,
    data: {
      format_version: BACKUP_VERSION,
      user_id: parsed.user_id,
      exported_at: typeof parsed.exported_at === 'string' ? parsed.exported_at : new Date().toISOString(),
      accounts: asArray(parsed.accounts) as Account[],
      categories: asArray(parsed.categories) as Category[],
      transactions: asArray(parsed.transactions) as Transaction[],
      recurring: asArray(parsed.recurring) as RecurringTransaction[],
    },
  }
}

export function validateBackupOwner(backup: Pick<BackupFile, 'user_id'>, currentUserId: string): boolean {
  return backup.user_id === currentUserId
}

export interface ImportCounts {
  accounts: number
  categories: number
  transactions: number
  recurring: number
}

type ImportDb = Pick<SupabaseClient, 'from'>

export async function executeImport(db: ImportDb, backup: BackupFile): Promise<ImportCounts> {
  const counts: ImportCounts = { accounts: 0, categories: 0, transactions: 0, recurring: 0 }

  if (backup.accounts.length > 0) {
    const rows = backup.accounts.map((r) => ({ ...r, user_id: backup.user_id }))
    const { error } = await db.from('accounts').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    counts.accounts = rows.length
  }

  if (backup.categories.length > 0) {
    const rows = backup.categories.map((r) => ({ ...r, user_id: backup.user_id }))
    const { error } = await db.from('categories').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    counts.categories = rows.length
  }

  if (backup.transactions.length > 0) {
    const rows = backup.transactions.map((r) => ({ ...r, user_id: backup.user_id }))
    const { error } = await db.from('transactions').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    counts.transactions = rows.length
  }

  if (backup.recurring.length > 0) {
    const rows = backup.recurring.map((r) => ({ ...r, user_id: backup.user_id }))
    const { error } = await db.from('recurring_transactions').upsert(rows, { onConflict: 'id' })
    if (error) throw error
    counts.recurring = rows.length
  }

  return counts
}
