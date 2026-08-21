# Desain: Sumber Dana (IB Exness, IB HFM, LYNK.ID)

## Ringkasan

Cashflow mencatat uang per orang (Bima, Aska, Nanda) dalam bentuk akun (tunai, bank, e-wallet, lainnya). Kebutuhan baru: dana yang masuk ke aplikasi berasal dari **sumber dana** eksternal — **IB Exness, IB HFM, LYNK.ID** — yang masing-masing punya saldo sendiri. Dari sumber dana ini, uang bisa **ditransfer ke akun bank** (misal bank Aska).

Keputusan desain: **sumber dana diimplementasikan sebagai tipe akun baru `'funding'`** di tabel `accounts` yang sudah ada. Tidak ada tabel baru. Transfer dari sumber dana ke bank memakai mekanisme transfer yang sudah ada.

## Keputusan Kunci

- **Opsi A (dipilih):** tambah nilai `'funding'` ke kolom `type` pada tabel `accounts`. Sumber dana = akun jenis baru, dipisahkan di UI, bisa dikelola (tambah/ubah/arsip/hapus) seperti akun biasa.
- Sumber dana punya saldo sendiri (dari `opening_balance` + transaksi transfer).
- Transfer sumber → bank: **transfer biasa** — saldo sumber berkurang, saldo bank bertambah.
- **Total saldo global** hanya menjumlahkan akun **non-funding**. Sumber dana punya subtotal tersendiri.
- **Sumber dana tidak tampil campur** sebagai akun biasa di dropdown transaksi, transfer antar akun, dashboard, dan laporan.

## Data Model (Database)

Migrasi baru pada tabel `accounts` untuk menambah nilai tipe:

```sql
alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('cash','bank','ewallet','other','funding'));
```

Tidak ada tabel baru. Semua RLS, multi-user, perhitungan saldo, dan transfer yang sudah ada otomatis bekerja karena memakai tabel `accounts` yang sama.

### TypeScript (`src/types/database.ts`)

- `AccountType` ditambah `'funding'`.
- `Account` interface tidak berubah (kolom sama).

## Perhitungan Saldo & Filter Tipe

### Helper (baru, `src/lib/`)
- `isFundingAccount(account)` — `account.type === 'funding'`.
- `isSpendableAccount(account)` — bukan `'funding'` (dipakai di dropdown akun, transaksi, transfer, dashboard).

### Perhitungan saldo (`src/lib/balances.ts`)
- **Tidak berubah.** `computeAccountBalances` sudah menangani semua tipe termasuk transfer dari sumber → bank (kurangi saldo `account_id`, tambah saldo `to_account_id`).
- **Total saldo** di halaman Akun hanya menjumlahkan akun non-funding. Sumber dana menampilkan subtotal sendiri di bagian Sumber Dana.

## Halaman Akun (AccountsPage)

1. Header + tombol aksi (Tambah Akun, Transfer antar akun — tetap).
2. Kartu **"Total saldo"** (hanya akun biasa).
3. Bagian **"Sumber Dana"** — kartu grid terpisah berisi akun `type='funding'`:
   - Nama, badge tipe, label pemilik (member), saldo.
   - Tombol **Transfer** per sumber dana → modal transfer sumber → bank.
   - Tombol edit / arsip / hapus (mengikuti read-only member).
4. Bagian **"Akun"** — daftar akun biasa (bank/ewallet/etc) seperti sekarang.

### Form akun (`AccountForm.tsx`)
- Tambah opsi tipe **"Sumber Dana"** (`funding`) di dropdown Tipe.
- Default tipe tetap `bank`.

## Transfer dari Sumber Dana ke Bank

### Modal baru "Transfer dari Sumber Dana"
- Dibuka dari tombol Transfer pada kartu sumber dana.
- Field: Dari (sumber dana), Ke (akun non-funding), jumlah, tanggal, catatan.
- Validasi: asal harus sumber dana; tujuan harus akun non-funding; asal ≠ tujuan; jumlah valid.
- Pencatatan: `type='transfer'`, `account_id`=asal, `to_account_id`=tujuan — memakai mekanisme yang ada. Transaksi muncul di riwayat/Dashboard.

### Pembatasan di fitur lain
- **Modal "Transfer Antar Akun" yang ada**: hanya menampilkan akun non-funding (asal & tujuan).
- **TransactionForm** (tambah/edit transaksi): dropdown Akun & "Transfer ke" hanya menampilkan akun non-funding. Sumber dana tidak punya kategori/pemasukan/pengeluaran.

## Penanganan Error

- Validasi modal transfer sumber → bank dengan toast error Bahasa Indonesia (mengikuti pola yang ada): pilih sumber dana, pilih tujuan non-funding, asal ≠ tujuan, jumlah valid.
- Error backend (RLS/read-only) diteruskan sebagai toast.
- `AccountType` diperketat; tidak ada `any`.

## Pengujian (vitest)

- `balances.test.ts`: transfer sumber→bank mengurangi saldo sumber & menambah saldo bank; `totalBalance` hanya akun biasa.
- Helper filter: `isFundingAccount` / `isSpendableAccount`.
- `AccountsPage.test.tsx`: bagian Sumber Dana terpisah, subtotal, tombol transfer per sumber dana.
- `AccountForm.test.tsx`: opsi tipe "Sumber Dana".
- `TransferModal.test.tsx`: tidak menampilkan akun funding.
- Verifikasi akhir: `npm test`, `npm run lint`, `npm run build`.
