import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BACKUP_VERSION, buildBackup, executeImport, parseBackup, validateBackupOwner } from './backup'
import type { Account, Category, FundingTransaction, RecurringTransaction, Transaction } from '../types/database'

type ImportDb = Parameters<typeof executeImport>[0]

const account: Account = {
  id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 0,
  color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z',
}
const category: Category = {
  id: 'cat-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'tag',
  color: '#f43f5e', created_at: '2026-01-01T00:00:00Z',
}
const transaction: Transaction = {
  id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'expense', category_id: 'cat-1',
  amount: 1000, to_account_id: null, note: '', date: '2026-08-01', receipt_url: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
}
const recurring: RecurringTransaction = {
  id: 'rec-1', user_id: 'user-1', name: 'Sewa', account_id: 'acc-1', category_id: 'cat-1',
  type: 'expense', amount: 100000, frequency: 'monthly', next_due_date: '2026-09-01',
  is_active: true, created_at: '2026-01-01T00:00:00Z',
}
const fundingTransaction: FundingTransaction = {
  id: 'ft-1', account_id: 'acc-1', amount: 250000, date: '2026-08-05', note: 'Top up',
  created_at: '2026-08-05T00:00:00Z',
}

function channel() {
  const upsert = vi
    .fn<(rows: unknown[], opts?: { onConflict: string }) => Promise<{ error: { message: string } | null }>>()
    .mockResolvedValue({ error: null })
  return { upsert, from: vi.fn<(table: string) => { upsert: typeof upsert }>(() => ({ upsert })) }
}

describe('buildBackup', () => {
  it('produces a versioned backup carrying the owning user id and all rows', () => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-08-20T00:00:00.000Z')
    const backup = buildBackup({
      userId: 'user-1',
      accounts: [account],
      categories: [category],
      transactions: [transaction],
      recurring: [recurring],
      fundingTransactions: [fundingTransaction],
    })
    expect(backup.format_version).toBe(BACKUP_VERSION)
    expect(backup.user_id).toBe('user-1')
    expect(backup.exported_at).toBe('2026-08-20T00:00:00.000Z')
    expect(backup.accounts).toEqual([account])
    expect(backup.categories).toEqual([category])
    expect(backup.transactions).toEqual([transaction])
    expect(backup.recurring).toEqual([recurring])
    expect(backup.fundingTransactions).toEqual([fundingTransaction])
    ;(Date.prototype.toISOString as unknown as ReturnType<typeof vi.fn>).mockRestore()
  })

  it('clones the input arrays so callers cannot mutate the backup', () => {
    const backup = buildBackup({
      userId: 'u', accounts: [account], categories: [], transactions: [], recurring: [], fundingTransactions: [],
    })
    expect(backup.accounts).not.toBe(account)
  })
})

describe('parseBackup', () => {
  it('accepts a well-formed backup', () => {
    const raw = JSON.stringify({
      format_version: 2,
      user_id: 'user-1',
      exported_at: '2026-08-20T00:00:00Z',
      accounts: [account],
      transactions: [transaction],
      fundingTransactions: [fundingTransaction],
    })
    const result = parseBackup(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.user_id).toBe('user-1')
      expect(result.data.accounts).toEqual([account])
      expect(result.data.transactions).toEqual([transaction])
      expect(result.data.categories).toEqual([])
      expect(result.data.fundingTransactions).toEqual([fundingTransaction])
    }
  })

  it('accepts a backup without a fundingTransactions key', () => {
    const raw = JSON.stringify({
      format_version: 2,
      user_id: 'user-1',
      exported_at: '2026-08-20T00:00:00Z',
      accounts: [account],
    })
    const result = parseBackup(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fundingTransactions).toEqual([])
    }
  })

  it('rejects malformed JSON', () => {
    expect(parseBackup('{ not json')).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('rejects a non-object payload', () => {
    expect(parseBackup('[1,2,3]')).toEqual({ ok: false, error: 'invalid-structure' })
  })

  it('rejects an unsupported version', () => {
    const result = parseBackup(JSON.stringify({ format_version: 99, user_id: 'user-1' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid-version')
  })

  it('rejects a backup without an owning user id', () => {
    const result = parseBackup(JSON.stringify({ format_version: 2 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid-structure')
  })
})

describe('validateBackupOwner', () => {
  it('is true when the backup belongs to the current user', () => {
    expect(validateBackupOwner({ user_id: 'user-1' }, 'user-1')).toBe(true)
  })

  it('is false when the backup belongs to another user', () => {
    expect(validateBackupOwner({ user_id: 'user-2' }, 'user-1')).toBe(false)
  })
})

describe('executeImport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts every table in foreign-key order with the owning user id on each row', async () => {
    const ch = channel()
    const db = { from: ch.from } as unknown as ImportDb
    const backup = {
      format_version: 2,
      user_id: 'user-1',
      exported_at: '2026-08-20T00:00:00Z',
      accounts: [account],
      categories: [category],
      transactions: [transaction],
      recurring: [recurring],
      fundingTransactions: [fundingTransaction],
    }

    const counts = await executeImport(db, backup)

    expect(counts).toEqual({ accounts: 1, categories: 1, transactions: 1, recurring: 1, fundingTransactions: 1 })
    expect(ch.from.mock.calls.map((c) => c[0])).toEqual([
      'accounts',
      'categories',
      'transactions',
      'recurring_transactions',
      'funding_transactions',
    ])
    expect(ch.upsert).toHaveBeenCalledWith(expect.any(Array), { onConflict: 'id' })
    const accountsCall = ch.upsert.mock.calls[0]?.[0] as Account[]
    expect(accountsCall[0]?.user_id).toBe('user-1')
    const fundingCall = ch.upsert.mock.calls[4]?.[0] as FundingTransaction[]
    expect(fundingCall[0]).toEqual(fundingTransaction)
  })

  it('skips empty tables and preserves the order', async () => {
    const ch = channel()
    const db = { from: ch.from } as unknown as ImportDb
    const backup = {
      format_version: 2,
      user_id: 'user-1',
      exported_at: '2026-08-20T00:00:00Z',
      accounts: [account],
      categories: [],
      transactions: [],
      recurring: [recurring],
      fundingTransactions: [],
    }

    const counts = await executeImport(db, backup)

    expect(counts).toEqual({ accounts: 1, categories: 0, transactions: 0, recurring: 1, fundingTransactions: 0 })
    expect(ch.from.mock.calls.map((c) => c[0])).toEqual(['accounts', 'recurring_transactions'])
  })

  it('surfaces an upsert error', async () => {
    const upsert = vi
      .fn<(rows: unknown[], opts?: { onConflict: string }) => Promise<{ error: { message: string } | null }>>()
      .mockResolvedValue({ error: { message: 'constraint violated' } })
    const db = { from: vi.fn(() => ({ upsert })) } as unknown as ImportDb
    const backup = {
      format_version: 2,
      user_id: 'user-1',
      exported_at: '2026-08-20T00:00:00Z',
      accounts: [account],
      categories: [],
      transactions: [],
      recurring: [],
      fundingTransactions: [],
    }

    await expect(executeImport(db, backup)).rejects.toThrow('constraint violated')
  })
})
