# Desain: Cashflow Multi-Pengguna (3 Orang)

## Ringkasan

Cashflow saat ini dipakai oleh 3 orang tetap: **Bima** (pemilik aplikasi), **Aska**, dan **Nanda** (atasan Bima). Sebelumnya tiap orang memakai email+password sendiri dan datanya terisolasi per akun. Tujuan perubahan:

1. **Login tanpa email** — halaman awal menampilkan 3 kartu (Bima / Aska / Nanda). Pilih kartu → isi password.
2. **Password pertama kali** dibuat via UI, disimpan aman oleh Supabase Auth, dan dipakai terus.
3. **Data cashflow sendiri per orang** (rekening, transaksi, kategori, recurring tetap terpisah per user).
4. **Dapat dilihat bersama** — semua orang bisa membaca/seluruh data siapa pun, tetapi hanya bisa mengedit data milik sendiri.
5. **Dashboard "Uang di Aska / Nanda / Bima"** (ringkasan saldo per orang) plus **dashboard global** (total gabungan), dengan akses ke tampilan rinci lengkap per orang.

## Keputusan Kunci

- **Tetap memakai Supabase Auth (Opsi 1).** Tiga akun istimewa dibuat lewat alur bootstrap UI. Email internal dipetakan ke 3 slot tetap.
- **Data tetap per-user** (`user_id`), RLS dimodifikasi: select lintas user diperbolehkan, tulis hanya untuk baris milik sendiri.
- **Pembuatan akun via UI bootstrap** (`SetupPage`), bukan skrip manual.
- **Frontend** menyediakan pemilih/filter orang dengan label pemilik pada tiap item; data milik orang lain read-only.

## Akun & Slot

3 slot tetap dipetakan dari email akun Supabase:

| Slot  | Email internal        |
|-------|-----------------------|
| Bima  | `bima@cashflow.local` |
| Aska  | `aska@cashflow.local` |
| Nanda | `nanda@cashflow.local` |

Slot ditentukan dari `user.email`. Profil memakai `full_name` sesuai slot.

## Auth & Alur Login

### Bootstrap (SetupPage)
- Muncul hanya jika sistem belum disetel (lihat `app_settings`).
- UI menampilkan 3 sesi untuk mengisi **password awal** masing-masing nama (Bima, Aska, Nanda).
- Membuat 3 akun lewat **Edge Function** (server-side, memakai Service Role yang tidak pernah disebarkan ke klien) untuk membuat akun (email internal + password) dan menyetel metadata `full_name`.
- Setelah sukses, menandai `setup_complete` di `app_settings`.
- Hanya berjalan sekali; tidak dapat diakses kembali setelah selesai.

### Login (LoginPage → kartu)
- Tampilkan 3 kartu nama: Bima / Aska / Nanda (dengan ikon/warna).
- Pilih kartu → input password.
- Jika akun tsb belum punya password (belum disetel), alur **set password pertama kali**.
- Jika sudah, verifikasi password via `signInWithPassword(emailInternal, password)`.
- Setelah login, sesi Supabase aktif; profil di-sync.

### Pengaturan Ulang / keluar
- Logout tersedia di aplikasi (Saklar akun → kembali ke halaman pilih kartu).

## RLS (Perubahan Database)

Agar semua orang dapat membaca data semua orang namun hanya menulis data miliknya:

- `profiles`: select milik sendiri (tidak berubah) — hanya untuk metadata login.
- `accounts`, `categories`, `transactions`, `recurring_transactions`:
  - `SELECT` → semua baris (semua pengguna berbagi-dataset di seluruh dataset).
  - `INSERT/UPDATE/DELETE` → hanya `auth.uid() = user_id`.
- Storage `receipts`: hanya pemilik yang dapat menulis/membaca file-nya (tidak berubah).

## UI (Frontend)

### Pemilih / Filter Orang
- Di halaman yang menampilkan data (Dashboard, Transaksi, Rekening, Kategori, Recurring, Laporan): kontrol **"Semua / Bima / Aska / Nanda"**.
- `Semua` = gabungan semua data dengan label pemilik.
- Pilih satu orang = data orang itu secara lengkap.

### Read-only untuk data orang lain
- Data milik pengguna yang sedang login → bisa diedit (tombol tampil).
- Data milik orang lain → read-only (tombol aksi disembunyikan; form create/update dibatasi).

### Dashboard
- Ringkasan per orang: kartu **"Uang di Aska"**, **"Uang di Nanda"**, **"Uang di Bima"** (total saldo rekening).
- **Kartu total/gabungan** (global).
- Grafik gabungan + akses ke tampilan rinci per orang.

### SetupPage
- Halaman bootstrap (lihat bagian Auth).

## Tabel Database Baru

### `app_settings`
| kolom        | tipe        | keterangan                       |
|--------------|-------------|----------------------------------|
| id           | int         | primary key (hanya 1 baris: `1`) |
| setup_complete | boolean   | menandai bootstrap selesai        |
| created_at   | timestamptz |                                  |

## Keamanan

- Password tidak pernah disimpan di aplikasi; hanya Supabase Auth yang menyimpan hash.
- RLS memastikan batasan baca-semua/tulis-own di level server, tidak bergantung hanya pada UI.
- Pembuatan akun dilakukan di Edge Function dengan Service Role; kredensial Service Role tidak pernah disebarkan ke klien. SetupPage hanya dapat dipanggil sekali (guard `setup_complete` di server).
- Validasi input dan penanganan error eksplisit; tidak ada `any`; TypeScript ketat.

## Penanganan Error

- Gagal bootstrap → pesan jelas, status tidak ditandai selesai, bisa diulang.
- Password salah → pesan terjemahan alur (mirip `translateAuthError`).
- Backend melarang edit data orang lain → toast error.

## Pengujian

- Unit: RLS hanya membolehkan tulis baris milik sendiri; read lintas user mengembalikan baris.
- Komponen: LoginPage (kartu+password), SetupPage, pemilih/filter, read-only state.
- Hook: pemetaan slot dari email, ringkasan per orang, dashboard gabungan.
- Jalankan `npm test`, `npm run lint`, `npm run build`.
