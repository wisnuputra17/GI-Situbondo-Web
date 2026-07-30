# PLN GI Suite (nama sementara — silakan ganti sesuai keinginan)

Web internal untuk monitoring & penyimpanan dokumen Gardu Induk (GI): profil GI,
file WP/BA/Peralatan, kondisi peralatan, posisi asset tower, counter peralatan,
dan anomali.

Arsitektur meniru pola IHSG Suite: `shared/` (kontrak API, store, format, UI) +
`features/` (satu folder per modul), dengan backend Google Sheets (data
terstruktur) + Google Drive (file) yang dijembatani lewat satu Google Apps
Script Web App.

## Struktur proyek

```
apps-script/Code.gs   → backend (deploy manual ke Google Apps Script)
shared/                → kode dipakai bersama semua modul
  api.js                → wrapper fetch ke Apps Script Web App
  store.js              → state store ringan lintas modul
  format.js             → format tanggal/angka gaya Indonesia
  tailwind-config.js    → token desain (warna/font) — sumber tunggal untuk semua halaman
  shell.js              → render sidebar + topbar (dipakai ulang di semua modul)
  header.js, ui.css     → DEPRECATED — tema lama (dark/SLD), sudah tidak dipakai, hanya referensi
features/               → satu modul per folder
  peta-tower/            → ✅ modul aktif pertama (peta Leaflet+OSM, marker GI & tower)
    index.html            → tampilan (Tailwind + Leaflet)
    db.js                 → logic data (load/save/append lewat shared/api.js)
index.html              → halaman beranda (⚠️ masih tema lama, belum dimigrasi ke shell baru)
```

Pemisahan tetap sama seperti IHSG Suite: **UI** (markup di `index.html` tiap modul),
**logic data** (`db.js` tiap modul, isinya cuma panggil `shared/api.js`), dan
**token desain bersama** (`shared/tailwind-config.js`) — tiga hal ini sengaja
dipisah supaya ganti tampilan tidak perlu bongkar logic data, dan sebaliknya.

## Setup backend (Google Apps Script)

1. Buat Google Sheet baru (kosong), catat **Spreadsheet ID** dari URL-nya
   (bagian antara `/d/` dan `/edit`).
2. Buat folder Google Drive di **Shared Drive**/folder yang sudah kalian
   bagikan berdua, catat **Folder ID**-nya (bagian akhir URL folder).
3. Buka [script.google.com](https://script.google.com) → New Project.
4. Hapus isi default, tempel isi `apps-script/Code.gs`.
5. Buka **Project Settings** (ikon gerigi) → **Script Properties** →
   tambahkan:

   | Key | Value |
   |---|---|
   | `SPREADSHEET_ID` | ID sheet dari langkah 1 |
   | `ROOT_FOLDER_ID` | ID folder dari langkah 2 |
   | `ACCESS_PASSWORD` | kode akses yang disepakati tim (bebas, mis. frasa acak) |

6. **Deploy → New deployment** → pilih tipe **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (akses sebenarnya tetap dijaga lewat
     `ACCESS_PASSWORD`, bukan lewat setting ini)
7. Salin URL yang diakhiri `/exec`.

## Setup frontend

1. Buka `shared/api.js`, ganti `CONFIG.API_URL` dengan URL `/exec` dari
   langkah di atas.
2. Push seluruh folder ke repo GitHub baru, aktifkan **GitHub Pages**
   (Settings → Pages → source: branch utama).
3. Buka situsnya — akan diminta memasukkan kode akses sekali (disimpan di
   sesi browser, akan diminta lagi jika browser/tab ditutup).

## Skema data (Sheets)

Sheet dibuat otomatis oleh backend saat pertama diakses, dengan kolom
berikut:

| Sheet | Kolom |
|---|---|
| `profil_gi` | id_gi, nama_gi, lokasi, lat, lng, tegangan, tahun_operasi, catatan, updated_at |
| `peralatan_master` | id_peralatan, id_gi, jenis, merk, tahun_pasang, status, updated_at |
| `kondisi_log` | timestamp, id_peralatan, kondisi, catatan, oleh |
| `tower_master` | id_tower, penghantar, nomor, lat, lng, alamat, ground_patrol, status, updated_at |
| `tower_anomali_log` | timestamp, id_tower, jenis_anomali, catatan, status, oleh |
| `counter_log` | timestamp, id_peralatan, jenis_counter, nilai, oleh |
| `anomali_log` | timestamp, id_peralatan, deskripsi, status, oleh |

Skema ini disiapkan di awal untuk semua modul, meski baru sheet `profil_gi`
dan `anomali_log` yang dipakai halaman beranda saat ini — modul lain akan
memakainya begitu masing-masing dibangun.

## Struktur folder Drive

```
[ROOT_FOLDER_ID]/
  [id_gi]/
    WP/
    BA/
    Peralatan/
    Spreadsheet/
```

Folder per-GI & sub-kategori dibuat otomatis saat file pertama diupload ke
path tersebut (lihat `getOrCreateFolderByPath` di `Code.gs`).

## Status modul

| Modul | Status |
|---|---|
| Backend & shared layer | ✅ Selesai |
| Peta & Tower | ✅ Fungsional — 417 tower, clustering, garis penghantar, catat/selesaikan anomali |
| Beranda (root index.html) | ⚠️ Masih tema lama, perlu dimigrasi ke shell baru |
| Profil GI (halaman detail terpisah) | ⏳ Belum — untuk saat ini profil GI dikelola dari tombol "Edit profil GI" di Peta & Tower |
| File Manager (WP/BA/Peralatan) | ⏳ Menyusul |
| Kondisi Peralatan | ⏳ Menyusul |
| Anomali Peralatan | ⏳ Menyusul |

**Catatan skema:** kolom `lat` dan `lng` ditambahkan ke `profil_gi` (untuk marker
GI di peta). Kalau sheet `profil_gi` sudah pernah dipakai sebelumnya dengan
skema lama, hapus isi sheet itu dulu (biarkan backend buat ulang otomatis
dengan header baru) — atau tambah kolom `lat`/`lng` manual di Sheets.

## Catatan keamanan

- Autentikasi saat ini: kode akses tunggal (`ACCESS_PASSWORD`) dicek di
  backend, dikombinasikan dengan URL yang tidak disebarluaskan. Cocok untuk
  tim kecil (2–5 orang) dengan tingkat kepercayaan tinggi.
- Kode akses **tidak** disimpan di kode sumber (bukan di GitHub) — hanya di
  Script Properties Apps Script, supaya tidak ikut ter-commit.
- `saveSheet`/`clearSheet` menimpa seluruh isi sheet — dipakai untuk operasi
  bulk, bukan untuk penulisan baris tunggal (pakai `apiAppend` untuk itu).
