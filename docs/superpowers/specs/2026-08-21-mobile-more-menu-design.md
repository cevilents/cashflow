# Desain: Bottom Nav Mobile — Menu "Lainnya"

## Ringkasan

Bottom nav mobile saat ini hanya menampilkan 5 menu pertama (`nav.slice(0, 5)`): Dashboard, Transaksi, Akun, Kategori, Berulang. Akibatnya **Sumber Dana, Laporan, dan Pengaturan tidak bisa diakses dari layar kecil**. Perubahan: jadikan item ke-5 bottom nav berlabel **"Lainnya"** yang membuka panel berisi semua menu yang tidak tampil langsung (Berulang, Sumber Dana, Laporan, Pengaturan).

## Keputusan Kunci

- Bottom nav mobile menampilkan 4 menu utama + 1 tombol "Lainnya": **Dashboard, Transaksi, Akun, Kategori, + Lainnya**.
- Tombol "Lainnya" membuka panel/daftar (memakai komponen `Modal` yang sudah ada, untuk konsistensi dan reuse) berisi menu tersisa: **Berulang, Sumber Dana, Laporan, Pengaturan**.
- Menu terpilih dari panel "Lainnya" menutup panel dan menavigasi ke rute tersebut.
- Sidebar desktop tidak berubah.
- Semua copy Bahasa Indonesia.

## Struktur Nav

- `nav` array (di `src/components/layout/Sidebar.tsx`) TIDAK berubah — tetap berisi semua 8 item.
- Untuk desktop: `Sidebar` memakai seluruh `nav` (tidak berubah).
- Untuk mobile `MobileNav`:
  - `mobilePrimary` = 4 item pertama: Dashboard, Transaksi, Akun, Kategori.
  - `mobileMore` = item sisanya: Berulang, Sumber Dana, Laporan, Pengaturan.
  - Item ke-5 (labelled "Lainnya", ikon `MoreHorizontal` dari lucide-react) membuka `Modal` berisi daftar `mobileMore`.

## Komponen

### `MobileNav` (ubah)
- Simpan 2 konstanta: item utama (4) dan item "lainnya" (4).
- State lokal `openMore` (boolean) untuk mengontrol `Modal`.
- Tampilkan 4 `NavLink` utama + 1 tombol "Lainnya" (bukan `NavLink`) yang membuka modal.
- `Modal` berjudul "Lainnya" berisi daftar `NavLink` untuk item lain; tiap klik menutup modal lalu navigasi (NavLink biasa; modal ditutup via onClick).

### Catatan ikon
- Tambah `MoreHorizontal` ke import lucide-react di `Sidebar.tsx`.

## Perilaku

- Saat rute aktif adalah salah satu item di "Lainnya" (misal `/sources`, `/reports`, `/settings`, `/recurring`), tombol "Lainnya" ditandai aktif (warna `text-good`) supaya user tahu sedanga ada di submenu.
- Menutup panel: tombol X / klik backdrop / Escape (dari `Modal` yang sudah ada) / memilih menu.

## Pengujian

- `Sidebar.test.tsx`:
  - Mobile bottom nav menampilkan 5 item: Dashboard, Transaksi, Akun, Kategori, **Lainnya** (bukan item menu langsung yang lain).
  - Item "Berulang" / "Sumber Dana" / "Laporan" / "Pengaturan" TIDAK tampil langsung di bottom nav.
  - Klik "Lainnya" membuka panel berisi Berulang, Sumber Dana, Laporan, Pengaturan.
  - Klik salah satu item di panel menutup panel (dan ber-navigasi).
- Verifikasi akhir: `npm test`, `npm run lint`, `npm run build`.

## Non-Tujuan

- Tidak mengubah sidebar desktop.
- Tidak menambah navigasi baru; hanya mengemas item yang sudah ada.
