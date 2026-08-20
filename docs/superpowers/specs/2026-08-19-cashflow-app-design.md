# Desain Aplikasi Cashflow

Tanggal: 2026-08-19
Status: Disetujui

## Tujuan

Aplikasi web untuk mencatat dan memantau transaksi keuangan pribadi: pemasukan, pengeluaran, dan transfer antar akun. Mendukung bukti transaksi berupa foto struk, kategori, dashboard dengan grafik, laporan, transaksi berulang, dan multi akun.

## Stack Teknologi

- **Frontend**: React + Vite + TypeScript (strict)
- **Styling**: Tailwind CSS
- **Data fetching**: TanStack Query
- **Chart**: Recharts
- **Routing**: React Router
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Testing**: Vitest + React Testing Library
- **Lint/typecheck**: ESLint + `tsc --noEmit`

Bahasa antarmuka: Bahasa Indonesia. Mata uang: Rupiah (`Rp 1.500.000`).

## Arsitektur

React SPA → Supabase (Postgres, Auth email/password, Storage). Tidak ada server lain.
Semua data per-user diakses lewat Supabase client dengan RLS aktif.

## Model Data (Supabase Postgres)

Semua tabel punya RLS: user hanya bisa akses baris miliknya sendiri (`user_id = auth.uid()`).

### `profiles`
| kolom | tipe | keterangan |
|---|---|---|
| id | uuid PK | = auth.users.id |
| full_name | text | nama pengguna |
| currency | text | default `IDR` |
| created_at | timestamptz | |

### `accounts`
| kolom | tipe | keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | text | nama akun |
| type | text | `cash` \| `bank` \| `ewallet` \| `other` |
| opening_balance | numeric(18,2) | saldo awal |
| color | text | warna akun |
| is_archived | boolean | default false |
| created_at | timestamptz | |

### `categories`
| kolom | tipe | keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | text | |
| type | text | `income` \| `expense` |
| icon | text | nama ikon (lucide) |
| color | text | |
| created_at | timestamptz | |

### `transactions`
| kolom | tipe | keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| account_id | uuid FK → accounts | akun sumber |
| type | text | `income` \| `expense` \| `transfer` |
| category_id | uuid FK nullable | tidak dipakai untuk transfer |
| amount | numeric(18,2) | selalu positif |
| to_account_id | uuid FK nullable | hanya untuk transfer |
| note | text | |
| date | date | |
| receipt_url | text nullable | path ke Supabase Storage |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `recurring_transactions`
| kolom | tipe | keterangan |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | text | nama tagihan |
| account_id | uuid FK | |
| category_id | uuid FK | |
| type | text | `income` \| `expense` |
| amount | numeric(18,2) | |
| frequency | text | `weekly` \| `monthly` \| `yearly` |
| next_due_date | date | jatuh tempo berikutnya |
| is_active | boolean | |
| created_at | timestamptz | |

## Perhitungan Saldo Akun

Saldo akun = `opening_balance + Σ pemasukan − Σ pengeluaran + Σ transfer_masuk − Σ transfer_keluar`.

Saldo tidak disimpan sebagai kolom — selalu diturunkan dari riwayat transaksi agar konsisten.
Transfer dicatat sekali di tabel transaksi (dengan `account_id` sumber + `to_account_id` tujuan), lalu pengaruhnya ke kedua akun dihitung dari kolom tersebut.

## Halaman & Fitur

1. **Login/Register** — email/password via Supabase Auth. Protected routes; redirect ke `/login` bila belum login.
2. **Dashboard (`/`)** — saldo total semua akun; grafik pemasukan vs pengeluaran 6 bulan terakhir; donut breakdown per kategori; 5 transaksi terbaru; tombol cepat "Tambah Transaksi".
3. **Transaksi (`/transactions`)** — daftar transaksi; pencarian teks; filter (tipe, akun, kategori, rentang tanggal); sortir tanggal; CRUD via modal; konfirmasi sebelum hapus.
4. **Laporan (`/reports`)** — pilih bulan/tahun; ringkasan total masuk, total keluar, selisih; rincian per kategori; export CSV; opsi cetak (PDF browser).
5. **Akun (`/accounts`)** — kelola akun (tambah/edit/hapus/arsip); saldo masing-masing; transfer antar akun (dari → ke; mengurangi & menambah kedua akun).
6. **Kategori (`/categories`)** — kelola kategori pemasukan/pengeluaran dengan ikon & warna.
7. **Transaksi Berulang (`/recurring`)** — daftar tagihan berulang; frekuensi weekly/monthly/yearly; tanggal jatuh tempo berikutnya; toggle aktif/nonaktif.
8. **Pengaturan (`/settings`)** — nama profil; export backup & import data (JSON).

## Bukti Transaksi (Gambar)

- **Supabase Storage**: bucket `receipts`, RLS per-owner. Path: `{userId}/{transactionId}/{timestamp}-{namaFile}`.
- Kolom `transactions.receipt_url` menyimpan path/lampiran. Satu lampiran per transaksi.
- Modal tambah/edit transaksi: pilih file (klik / drag-drop), pratinjau sebelum simpan, batas 5 MB, tombol hapus lampiran.
- Daftar transaksi: ikon lampiran; klik membuka lightbox gambar besar. Transfer tidak punya lampiran.

## Aturan

- Tipe transaksi hanya 3: `income`, `expense`, `transfer`. Transfer tidak memakai kategori.
- Validasi form: amount > 0, akun wajib dipilih, tanggal valid.
- Format uang Rupiah: `Rp 1.500.000`.
- Akun **tidak bisa dihapus** jika sudah punya transaksi — pengguna harus mengarsipkan akun tersebut. Akun tanpa transaksi boleh dihapus.
- Kategori yang sudah dipakai transaksi: ketika dihapus, `category_id` transaksi di-set `NULL` (transaksi tetap ada).

## Tampilan Visual & UX

- Dark finance app modern, bersih, fokus keterbacaan angka.
- Hijau = pemasukan, merah/rose = pengeluaran, biru = transfer.
- Font tabular untuk angka agar daftar saldo rapi.
- Sidebar navigasi (responsif → bottom bar di mobile).
- Kartu statistik, chart (area/bar tren, donut kategori), modal CRUD, toast notifikasi, empty states informatif.
- Responsif desktop & mobile.

## Error Handling

- Validasi form di semua input.
- Konfirmasi sebelum hapus.
- Toast sukses/gagal; loading state di semua aksi.
- Empty states jelas.

## Testing

- **Vitest + React Testing Library**: perhitungan saldo akun, format Rupiah, filter/sortir transaksi, logika transfer, jadwal transaksi berulang, validasi form.
- **TypeScript strict** + ESLint.
- Verifikasi manual akhir di browser: login → tambah transaksi → upload gambar → cek dashboard.
