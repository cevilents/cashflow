# Desain: Sumber Dana Shared + Top-Up dengan Detail Tanggal

## Ringkasan

Sumber dana (IB Exness, IB HFM, LYNK.ID — akun `type='funding'`) saat ini bersifat **per-user** dan mengikuti aturan read-only (semua bisa lihat, hanya pemilik yang mengelola). Kebutuhan baru:
1. **Shared / dipakai bersama** — semua member (Bima, Aska, Nanda) bisa **bebas mengelola** (buat, edit, transfer, arsip, hapus) sumber dana siapa pun.
2. **Bisa TOP-UP / penyesuaian saldo** — misal Exness bulan 1 = 18jt, bulan 2 = 12jt (tambah/kurangi saldo sumber dana).
3. **Ada detail tanggal & riwayat** pemasukan/penyesuaian sumber dana, supaya riwayat saldo rinci.
4. **Aturan hapus dipertahankan**: sumber dana yang sudah punya aktivitas tidak bisa hard-delete (hanya diarsipkan).

Batasan: hanya **sumber dana** yang dibagi bebas. Akun bank, kategori, transaksi biasa, recurring tetap per-user / read-only seperti sekarang. Top-up sumber dana **tidak** muncul sebagai pemasukan palsu di laporan/Dashboard (yang tetap berbasis `transactions` biasa).

## Keputusan Kunci

- **RLS baru** untuk `accounts.type='funding'`: semua authenticated boleh menulis (bukan hanya pemilik). Akun non-funding tetap write-own.
- **Tabel baru `funding_transactions`** untuk mencatat riwayat penyesuaian saldo per sumber dana (amount bertanda, tanggal, catatan).
- **Saldo sumber dana** = `opening_balance` + jumlah penyesuaian (`funding_transactions.amount`) − total transfer keluar (dari `transactions` `type='transfer'` yang sudah ada).
- **UI**: halaman Sumber Dana membuka kontrol aksi untuk semua member; tambah tombol "Penyesuaian/Top Up" + tampilan riwayat ringkas per sumber.
- Reuse pola Form/Modal/Toast/ConfirmDialog yang sudah ada.

## Database (migrasi baru)

### 1. RLS: izinkan semua authenticated menulis sumber dana

`accounts` memakai 2 policy per-or: `accounts select all` (all authenticated) dan `accounts write own` (`auth.uid() = user_id`). Tambahkan policy permissive `accounts write all funding`:

```sql
drop policy if exists "accounts write all funding" on public.accounts;
create policy "accounts write all funding" on public.accounts for all
  using (type = 'funding')
  with check (type = 'funding');
```

Karena policy RLS bersifat OR, baris `type='funding'` lolos lewat policy ini (siapa pun), sedangkan baris non-funding tetap hanya lewat `write own`. `with check` membolehkan semua user membuat baris funding (INSERT). `user_id` pada baris funding tetap diisi pembuat sebagai label kepemilikan.

Catatan: `DROP POLICY` ditulis idempotent (`if exists`) agar aman.

### 2. Tabel `funding_transactions`

```sql
create table if not exists public.funding_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount numeric(18,2) not null check (amount <> 0),
  date date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.funding_transactions enable row level security;

create policy "funding_transactions select all" on public.funding_transactions for select
  using (auth.role() = 'authenticated');
create policy "funding_transactions write all" on public.funding_transactions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

- `amount` bertanda: **positif = top-up**, **negatif = penarikan/penyesuaian turun**.
- RLS: select/write untuk semua authenticated (karena sumber dana shared).
- FK `account_id → accounts on delete cascade`: aman, tapi UI mencekal delete bila ada `funding_transactions` (lihat aturan hapus).

## Model Saldo

### TypeScript (`src/types/database.ts`)
```ts
export interface FundingTransaction {
  id: string
  account_id: string
  amount: number
  date: string
  note: string
  created_at: string
}
```

### Perhitungan (`src/lib/balances.ts`)
Perluas `computeAccountBalances` dengan parameter opsional `fundingTransactions?: FundingTransaction[]`, tanpa mengubah pemanggil yang ada (default `undefined`):

```ts
export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
  fundingTransactions?: FundingTransaction[],
): Record<string, number> {
  const balances: Record<string, number> = {}
  for (const acc of accounts) balances[acc.id] = Number(acc.opening_balance) || 0
  for (const f of fundingTransactions ?? []) {
    balances[f.account_id] = (balances[f.account_id] ?? 0) + Number(f.amount)
  }
  for (const t of transactions) { /* tidak berubah */ }
  return balances
}
```

Jadi saldo sumber dana = opening + total penyesuaian − transfer keluar (transfer sudah dikurangkan di cabang `transfer`). Pemanggil lain (Dashboard, AccountsPage, dll) tidak terpengaruh. `spendableTotalBalance` / `totalFundingBalance` / `totalBalanceByMember` tidak berubah.

## Hook & Query

### `src/hooks/useFundingTransactions.ts` (baru)
- `useFundingTransactions()` — SELECT semua baris (query key `['funding-transactions', user?.id]`).
- `useCreateFundingTransaction()` — INSERT (user sees own acting user); invalidasi `['funding-transactions']` + `['accounts']`.
- `useDeleteFundingTransaction?` — opsional; kebutuhan ini hanya tambah & lihat, bukan hapus riwayat. (YAGNI: tidak dibuat kecuali diminta.)

Pemanggilan yang mengubah saldo (top-up) harus juga mempertimbangkan apakah mau ikut mengubah `opening_balance`. Simplify: `opening_balance` dibiarkan sebagai saldo awal saat akun dibuat; semua penyesuaian berikutnya via `funding_transactions`. Tambah via modal "Penyesuaian Saldo".

## UI: Halaman Sumber Dana (`FundingSourcesPage.tsx`)

### 1. Semua member bisa mengelola (shared)
- Hapus gating `useReadOnly` di `SourceCard` (tombol Transfer/Ubah/Arsipkan/Hapus selalu tampil untuk semua member).
- Hapus `canManage` pada tombol "Tambah Sumber Dana" (selalu tampil).
- `MemberFilter` tetap ada untuk memudahkan melihat sumber berdasarkan pembuat, tapi aksi tetap terbuka untuk semua.

### 2. Tombol "Penyesuaian / Top Up"
- Pada tiap kartu sumber dana, tambahkan tombol ikon (misal `PlusCircle` / `TrendingUp`) ber-label aksesibel "Penyesuaian" yang membuka **`FundingAdjustmentModal`** (baru) untuk mencatat penyesuaian saldo:
  - **Jenis**: Top Up (tambah) / Penarikan (kurang) — pilih.
  - **Jumlah**, **Tanggal** (default hari ini), **Catatan** (opsional).
  - Submit → INSERT ke `funding_transactions` dengan `amount` bertanda sesuai jenis, `date`, `note`.

### 3. Riwayat ringkas
- Pada kartu sumber dana (atau di modal), tampilkan riwayat `funding_transactions` terbaru (tanggal, jumlah, catatan) agar "detail tanggal pemasukan" terlihat.
- Pendekatan: kartu menampilkan beberapa entri terakhir (misal 3-4) dengan `formatRupiah` + tanggal, atau tombol membuka modal riwayat penuh. (Pilih yang ringkas & sesuai; usul: tampilkan riwayat terakhir dalam kartu, plus modal untuk lengkap.)

### 4. Aturan hapus
- Perluas cek "punya aktivitas": blokir hard-delete bila sumber punya `transactions` ATAU `funding_transactions` (saran: arsipkan).
- Hanya hapus bila tidak ada aktivitas sama sekali.

### 5. AkunForm / transfer
- `AccountForm lockType="funding"` tetap (membuat sumber dana baru, semua member boleh).
- `FundingTransferModal` tetap memilih sumber → akun spendable; hanya sekarang semua member bisa memicunya (karena gating aksi dibuka).

## Penanganan Error

- Toast Bahasa Indonesia (pola yang ada) untuk gagal simpan/arsip/hapus/penyesuaian/transfer.
- Validasi modal penyesuaian: pilih jenis, jumlah valid (parseAmountInput), tanggal valid.
- Numerik: `amount <> 0` divalidasi (jangan 0).

## Pengujian

- `balances.test.ts`: `computeAccountBalances` dengan `fundingTransactions` menambah saldo sumber (positif) / mengurangi (negatif); pemanggil lama tanpa `fundingTransactions` tidak berubah.
- `FundingSourcesPage.test.tsx`: aksi terlihat untuk sumber milik member lain (bukan read-only lagi); tombol Penyesuaian membuka modal; modal submit mengirim payload `funding_transactions` bertanda benar; riwayat tampil.
- `FundingAdjustmentModal.test.tsx` (baru): validasi + submit payload.
- RLS: migrasi menambah policy funding; test written di level komponen (RLS diverifikasi via review SQL + sanity di DB).
- Verifikasi akhir: `npm test`, `npm run lint`, `npm run build`.

## Non-Tujuan

- Tidak mengubah akun bank/kategori/transaksi/recurring (tetap per-user read-only).
- Top-up sumber dana tidak masuk laporan pemasukan/pengeluaran/Dashboard.
- Tidak menambah fitur hapus/edit riwayat `funding_transactions` (hanya tambah & lihat) kecuali diminta.
- Tidak mengubah `opening_balance` retroaktif; penyesuaian lewat `funding_transactions`.
