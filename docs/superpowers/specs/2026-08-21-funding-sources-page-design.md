# Desain: Halaman Khusus "Sumber Dana"

## Ringkasan

Fitur sumber dana (IB Exness, IB HFM, LYNK.ID dll, tipe akun `'funding'`) yang sebelumnya tampil di bagian terpisah dalam halaman Akun, kini dipindah ke **halaman khusus sendiri** ("Sumber Dana") di sidebar — memisahkan sumber dana sepenuhnya dari halaman Akun (yang kini murni akun biasa).

## Keputusan Kunci

- Halaman khusus penuh **"Sumber Dana"** di sidebar, dengan rute `path="/sources"`.
- Bagian "Sumber Dana" yang ada di `AccountsPage` **dihapus** (list, subtotal, tombol transfer, state terkait) — halaman Akun murni akun biasa; total saldo Akun tetap non-funding.
- Halaman Sumber Dana berisi: header + tombol tambah, filter member, kartu subtotal saldo sumber, grid kartu sumber (nama, warna, badge, pemilik, saldo, tombol transfer/edit/arsip/hapus), read-only untuk sumber milik member lain.
- Transfer sumber→bank memakai `FundingTransferModal` yang sudah ada.
- CRUD sumber dana memakai `AccountForm` yang sudah ada, dengan tipe dikunci `'funding'` saat dibuka dari halaman ini.
- Reuse helper: `isFundingAccount`/`isSpendableAccount` (`src/lib/accounts.ts`), `spendableTotalBalance`/`totalFundingBalance`/`computeAccountBalances` (`src/lib/balances.ts`).

## Navigasi & Routing

- `Sidebar.tsx`: tambah entri `{ to: '/sources', label: 'Sumber Dana', icon: <icon> }` pada array `nav`.
- `App.tsx`: tambah `<Route path="/sources" element={<FundingSourcesPage />} />` di dalam `ProtectedRoute`/`AppLayout`.
- Icon: gunakan `Landmark` dari lucide-react (tersedia di versi 1.33 yang dipakai).
- MobileNav memakai `nav.slice(0, 5)`: saat ini Dashboard, Transaksi, Akun, Kategori, Berulang. Sumber Dana di posisi setelah Akun → tidak masuk 5 besar mobile nav (konsisten dengan Laporan/Pengaturan yang juga tidak masuk). Tidak perlu ubah `slice` kecuali diinginkan.

## Halaman: `FundingSourcesPage` (baru)

Dibuat mengikuti pola `AccountsPage.tsx`:

1. Header: judul "Sumber Dana", subjudul, tombol **"Tambah Sumber Dana"**.
2. `MemberFilter` (Semua/Bima/Aska/Nanda) — sesuai pola halaman lain.
3. Kartu **subtotal** "Total sumber dana" = `totalFundingBalance(balances, filteredFundingAccounts)`.
4. Grid kartu sumber dana (hanya `type='funding'`, tidak diarsip, sesuai filter owner; bagian "Diarsipkan" memakai pola yang sama seperti AccountsPage).
5. Tiap kartu: warna, nama, badge "Sumber Dana", label pemilik (`getMemberById`), saldo (`formatRupiah`), jumlah transaksi (opsional), tombol **Transfer** (sumber→bank via `FundingTransferModal`), tombol edit/arsip/hapus (disembunyikan bila read-only).

### Form tambah/edit

- Buka `AccountForm` dengan mode khusus: saat dipanggil dari halaman Sumber Dana, dropdown Tipe **tersembunyi dan dikunci ke `'funding'`** (tambah) / `editing.type` (edit). Ini mencegah membuat akun non-funding dari halaman ini.
- Cara: tambahkan prop opsional `lockType?: AccountType` pada `AccountForm`. Saat `lockType` diisi, state `type` di-set ke nilai itu dan dropdown Tipe tidak dirender (hanya label ringkas).

## Perubahan `AccountsPage`

- Hapus: impor `isFundingAccount`, `spendableTotalBalance`/`totalFundingBalance`, `FundingTransferModal`, `ArrowDownToLine`.
- Hapus: state `fundingTransfer`, memo `fundingTotal`, variabel `funding`, bagian JSX "Sumber Dana", prop `onTransfer` pada `AccountCard`, tombol transfer di kartu.
- Pertahankan: `spendableTotalBalance` dipakai untuk "Total saldo" (non-funding), `list` memakai `isSpendableAccount`.
- Test `AccountsPage.test.tsx`: hapus 3 test sumber dana yang ditambahkan sebelumnya; pemindahan ke halaman baru.

## Reuse & Konsistensi

- `FundingTransferModal`, `isFundingAccount`/`isSpendableAccount`, `spendableTotalBalance`/`totalFundingBalance`, komponen UI (Button, EmptyState, Spinner, Modal, MemberFilter).
- Semua copy Bahasa Indonesia mengikuti pola yang ada.

## Penanganan Error

- Toast Bahasa Indonesia (pola yang ada): gagal simpan/hapus/arsip/transfer ditampilkan sebagai toast.
- Data milik orang lain read-only (tombol aksi disembunyikan).

## Pengujian

- `FundingSourcesPage.test.tsx` (baru): render daftar sumber + subtotal, tombol tambah membuka form tipe `funding`, tombol transfer membuka `FundingTransferModal`, read-only utk sumber milik member lain.
- `Sidebar.test.tsx`: entri "Sumber Dana" muncul.
- `AccountForm.test.tsx`: prop `lockType` mengunci tipe & menyembunyikan dropdown.
- `AccountsPage.test.tsx`: hapus test sumber dana lama; pastikan tetap lulus.
- Verifikasi akhir: `npm test`, `npm run lint`, `npm run build`.

## Cakupan Non-Tujuan

- Tidak mengubah migrasi DB (tipe `funding` sudah ada).
- Tidak mengubah Dashboard/balance semantics (sudah non-funding dari fitur sebelumnya).
- Tidak menambah riwayat transfer di dalam halaman (di luar cakupan).
