/**
 * features/peminjaman/db.js
 * Logika data modul Peminjaman Peralatan (alat kantor) — GI Situbondo.
 *
 * Setiap ALAT dicatat sebagai unit fisik satuan (1 baris = 1 barang), bukan
 * stok bertumpuk — jadi status per unit jelas: 'tersedia' atau 'dipinjam'.
 * PERSONIL dipilih dari daftar (tanpa password — cuma untuk catat siapa
 * pinjam/kembalikan). Riwayat peminjaman dicatat di peminjaman_log: satu
 * baris per transaksi pinjam, di-UPDATE saat alat dikembalikan (bukan
 * ditambah baris baru) supaya gampang dicari peminjaman AKTIF.
 *
 * Foto WAJIB di kedua tahap: saat pinjam (kondisi awal) dan saat kembali
 * (kondisi akhir) — disimpan ke Google Drive lewat shared/api.js
 * (apiUploadFile), path 'Peminjaman/'.
 *
 * Sheet:
 *   personil_master: id_personil, nama, jabatan, updated_at
 *   alat_master:     id_alat, nama_alat, kategori, kondisi, status, catatan, updated_at
 *   peminjaman_log:  id_pinjam, id_alat, id_personil, status,
 *                     tanggal_pinjam, foto_pinjam_url, catatan_pinjam,
 *                     tanggal_kembali, foto_kembali_url, catatan_kembali
 */

const KATEGORI_ALAT = [
  'Elektronik', 'Perkakas', 'Alat Ukur', 'Alat Safety (K3)', 'Komputer/IT', 'Lain-lain'
];

const KONDISI_ALAT = [
  { key: 'baik', label: 'Baik' },
  { key: 'perlu_perbaikan', label: 'Perlu perbaikan' },
  { key: 'rusak', label: 'Rusak' }
];

function labelKondisi(key) {
  return (KONDISI_ALAT.find((k) => k.key === key) || { label: key || '—' }).label;
}

function idBaru(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ---------- Personil ----------
async function loadPersonil() {
  const rows = await apiLoad('personil_master');
  return rows
    .filter((r) => r && r.id_personil)
    .map((r) => ({
      id_personil: String(r.id_personil),
      nama: r.nama || '',
      jabatan: r.jabatan || '',
      updated_at: r.updated_at || ''
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

async function addPersonil({ nama, jabatan }) {
  if (!String(nama || '').trim()) throw new Error('Nama personil wajib diisi');
  const row = { id_personil: idBaru('PSN'), nama: nama.trim(), jabatan: jabatan || '', updated_at: new Date().toISOString() };
  await apiAppend('personil_master', row);
  return row;
}

// ---------- Alat ----------
async function loadAlat() {
  const rows = await apiLoad('alat_master');
  return rows
    .filter((r) => r && r.id_alat)
    .map((r) => ({
      id_alat: String(r.id_alat),
      nama_alat: r.nama_alat || '',
      kategori: r.kategori || 'Lain-lain',
      kondisi: r.kondisi || 'baik',
      status: r.status || 'tersedia', // 'tersedia' | 'dipinjam'
      catatan: r.catatan || '',
      updated_at: r.updated_at || ''
    }))
    .sort((a, b) => a.kategori.localeCompare(b.kategori) || a.nama_alat.localeCompare(b.nama_alat));
}

async function addAlat({ nama_alat, kategori, kondisi, catatan }) {
  if (!String(nama_alat || '').trim()) throw new Error('Nama alat wajib diisi');
  const row = {
    id_alat: idBaru('ALT'),
    nama_alat: nama_alat.trim(),
    kategori: kategori || 'Lain-lain',
    kondisi: kondisi || 'baik',
    status: 'tersedia',
    catatan: catatan || '',
    updated_at: new Date().toISOString()
  };
  await apiAppend('alat_master', row);
  return row;
}

async function updateAlatStatus(idAlat, status, kondisi) {
  const semua = await loadAlat();
  const updated = semua.map((a) => a.id_alat === idAlat
    ? { ...a, status, ...(kondisi ? { kondisi } : {}), updated_at: new Date().toISOString() }
    : a);
  await apiSave('alat_master', updated);
  return updated;
}

// ---------- Peminjaman ----------
async function loadPeminjaman() {
  const rows = await apiLoad('peminjaman_log');
  return rows
    .filter((r) => r && r.id_pinjam)
    .map((r) => ({
      id_pinjam: String(r.id_pinjam),
      id_alat: String(r.id_alat || ''),
      id_personil: String(r.id_personil || ''),
      status: r.status || 'dipinjam', // 'dipinjam' | 'dikembalikan'
      tanggal_pinjam: r.tanggal_pinjam || '',
      foto_pinjam_url: r.foto_pinjam_url || '',
      catatan_pinjam: r.catatan_pinjam || '',
      tanggal_kembali: r.tanggal_kembali || '',
      foto_kembali_url: r.foto_kembali_url || '',
      catatan_kembali: r.catatan_kembali || ''
    }))
    .sort((a, b) => String(b.tanggal_pinjam).localeCompare(String(a.tanggal_pinjam)));
}

/**
 * Catat peminjaman baru: tambah baris peminjaman_log + tandai alat 'dipinjam'.
 * Foto wajib (URL Drive, sudah diupload sebelumnya lewat apiUploadFile).
 */
async function pinjamAlat({ id_alat, id_personil, foto_pinjam_url, catatan_pinjam }) {
  if (!id_alat) throw new Error('Pilih alat yang mau dipinjam');
  if (!id_personil) throw new Error('Pilih nama peminjam');
  if (!foto_pinjam_url) throw new Error('Foto kondisi alat wajib diunggah saat meminjam');

  const alatList = await loadAlat();
  const alat = alatList.find((a) => a.id_alat === id_alat);
  if (!alat) throw new Error('Alat tidak ditemukan');
  if (alat.status === 'dipinjam') throw new Error('Alat ini sedang dipinjam — belum dikembalikan');

  const row = {
    id_pinjam: idBaru('PJM'),
    id_alat, id_personil,
    status: 'dipinjam',
    tanggal_pinjam: new Date().toISOString(),
    foto_pinjam_url,
    catatan_pinjam: catatan_pinjam || '',
    tanggal_kembali: '', foto_kembali_url: '', catatan_kembali: ''
  };
  await apiAppend('peminjaman_log', row);
  await updateAlatStatus(id_alat, 'dipinjam');
  return row;
}

/**
 * Catat pengembalian: UPDATE baris peminjaman_log yang masih 'dipinjam'
 * (bukan tambah baris baru) + tandai alat 'tersedia'. Kondisi alat saat
 * kembali bisa disesuaikan (mis. jadi 'perlu_perbaikan') dari catatan.
 */
async function kembalikanAlat({ id_pinjam, foto_kembali_url, catatan_kembali, kondisi_setelah }) {
  if (!foto_kembali_url) throw new Error('Foto kondisi alat wajib diunggah saat mengembalikan');

  const semua = await loadPeminjaman();
  const target = semua.find((p) => p.id_pinjam === id_pinjam);
  if (!target) throw new Error('Data peminjaman tidak ditemukan');
  if (target.status === 'dikembalikan') throw new Error('Peminjaman ini sudah selesai dikembalikan');

  const updated = semua.map((p) => p.id_pinjam === id_pinjam
    ? {
        ...p,
        status: 'dikembalikan',
        tanggal_kembali: new Date().toISOString(),
        foto_kembali_url,
        catatan_kembali: catatan_kembali || ''
      }
    : p);
  await apiSave('peminjaman_log', updated);
  await updateAlatStatus(target.id_alat, 'tersedia', kondisi_setelah || undefined);
  return updated.find((p) => p.id_pinjam === id_pinjam);
}

// ---------- Pengolahan / ringkasan ----------

/** Gabungkan alat + personil + riwayat peminjaman terkini per alat, untuk kartu monitoring. */
function rangkumAlat(alatList, peminjamanList, personilList) {
  const personilById = {};
  personilList.forEach((p) => { personilById[p.id_personil] = p; });

  const riwayatPerAlat = {};
  peminjamanList.forEach((p) => {
    if (!riwayatPerAlat[p.id_alat]) riwayatPerAlat[p.id_alat] = [];
    riwayatPerAlat[p.id_alat].push(p);
  });
  Object.values(riwayatPerAlat).forEach((arr) =>
    arr.sort((a, b) => String(b.tanggal_pinjam).localeCompare(String(a.tanggal_pinjam))));

  return alatList.map((a) => {
    const riwayat = riwayatPerAlat[a.id_alat] || [];
    const aktif = riwayat.find((r) => r.status === 'dipinjam') || null;
    return {
      ...a,
      riwayat,
      peminjamAktif: aktif ? (personilById[aktif.id_personil] || null) : null,
      pinjamanAktif: aktif,
      jumlahDipinjam: riwayat.length
    };
  });
}

/** Ringkasan untuk kartu metrik. */
function ringkasPeminjaman(alatRangkuman) {
  return {
    total: alatRangkuman.length,
    tersedia: alatRangkuman.filter((a) => a.status === 'tersedia').length,
    dipinjam: alatRangkuman.filter((a) => a.status === 'dipinjam').length,
    perluPerbaikan: alatRangkuman.filter((a) => a.kondisi !== 'baik').length
  };
}

/** Teks notifikasi Telegram saat ada peminjaman baru. */
function teksNotifPinjam(alat, personil) {
  return (
    `📦 <b>Peminjaman Alat — GI Situbondo</b>\n` +
    `Alat: <b>${alat.nama_alat}</b> (${alat.kategori})\n` +
    `Dipinjam oleh: <b>${personil.nama}</b>${personil.jabatan ? ' — ' + personil.jabatan : ''}\n` +
    `Waktu: ${new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`
  );
}

/** Teks notifikasi Telegram saat alat dikembalikan. */
function teksNotifKembali(alat, personil) {
  return (
    `✅ <b>Pengembalian Alat — GI Situbondo</b>\n` +
    `Alat: <b>${alat.nama_alat}</b> (${alat.kategori})\n` +
    `Dikembalikan oleh: <b>${personil.nama}</b>${personil.jabatan ? ' — ' + personil.jabatan : ''}\n` +
    `Waktu: ${new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`
  );
}
