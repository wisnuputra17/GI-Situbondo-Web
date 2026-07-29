# Konvensi modul

Setiap modul baru dibuat sebagai satu folder di sini, misalnya:

```
features/profil-gi/
  index.html   → halaman modul, pakai shared/ui.css + shared/header.js
  db.js        → logic akses data modul ini (pakai apiLoad/apiSave/apiAppend/apiClear dari shared/api.js)
```

Modul berikutnya yang akan dibangun (sesuai urutan yang disepakati):
1. `profil-gi` — data referensi GI, dipakai modul lain sebagai daftar rujukan
2. `file-manager` — upload/lihat file WP, BA, Peralatan per GI
3. `kondisi-peralatan`, `tower-asset`, `counter-monitoring`, `anomali-peralatan`

Saat modul baru ditambahkan, daftar `NAV_ITEMS` di `shared/header.js` perlu
diperbarui: ubah `ready: false` menjadi `ready: true` dan sesuaikan `href`.
