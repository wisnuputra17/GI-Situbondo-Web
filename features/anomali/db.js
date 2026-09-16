/**
 * features/anomali/db.js
 * Logika data halaman Anomali — menyatukan temuan dari tiga sumber yang
 * selama ini tercatat terpisah:
 *   tower_anomali_log   → anomali menara transmisi
 *   kondisi_log         → hasil pemeriksaan peralatan (yang bukan normal)
 *   jaring_kerusakan_log→ kerusakan jaring pengaman
 *
 * Tujuannya satu tempat untuk melihat semua temuan, termasuk yang sudah
 * ditutup — sesuatu yang tidak bisa dilakukan lewat peta atau denah.
 */

const SUMBER = [
  { key: 'tower',     label: 'Menara',    ikon: 'cell_tower',              sheet: 'tower_anomali_log' },
  { key: 'peralatan', label: 'Peralatan', ikon: 'precision_manufacturing', sheet: 'kondisi_log' },
  { key: 'jaring',    label: 'Jaring',    ikon: 'grid_on',                 sheet: 'jaring_kerusakan_log' }
];

/**
 * Normalisasi tiga bentuk log berbeda jadi satu bentuk seragam.
 * Kunci gabungan `uid` dipakai untuk mencocokkan baris saat menutup temuan.
 */
function normalTower(r) {
  return {
    uid: 'tower|' + r.timestamp + '|' + r.id_tower,
    sumber: 'tower',
    objek: String(r.id_tower || ''),
    timestamp: r.timestamp || '',
    judul: r.jenis_anomali || 'Anomali',
    catatan: r.catatan || '',
    status: (r.status || 'open') === 'open' ? 'terbuka' : 'selesai',
    tingkat: 'perhatian',
    oleh: r.oleh || ''
  };
}

function normalPeralatan(r) {
  const k = String(r.kondisi || '');
  return {
    uid: 'peralatan|' + r.timestamp + '|' + r.id_peralatan,
    sumber: 'peralatan',
    objek: String(r.id_peralatan || ''),
    timestamp: r.timestamp || '',
    judul: k === 'rusak' ? 'Peralatan rusak'
         : k === 'perhatian' ? 'Perlu perhatian'
         : k === 'nonaktif' ? 'Non-aktif' : 'Pemeriksaan',
    catatan: r.catatan || '',
    // kondisi_log tidak punya kolom status; baris 'normal' dianggap penutup
    status: k === 'normal' ? 'selesai' : 'terbuka',
    tingkat: k === 'rusak' ? 'parah' : 'perhatian',
    oleh: r.oleh || '',
    kondisi: k
  };
}

function normalJaring(r) {
  const k = String(r.kondisi || '');
  return {
    uid: 'jaring|' + r.timestamp + '|' + r.id_jaring,
    sumber: 'jaring',
    objek: String(r.id_jaring || ''),
    timestamp: r.timestamp || '',
    judul: r.jenis_kerusakan || (k === 'parah' ? 'Kerusakan parah' : k === 'ringan' ? 'Kerusakan ringan' : 'Pemeriksaan'),
    catatan: r.catatan || '',
    status: (k === 'normal' || k === 'kosong') ? 'selesai' : 'terbuka',
    tingkat: k === 'parah' ? 'parah' : 'perhatian',
    oleh: r.oleh || '',
    kondisi: k
  };
}

/**
 * Baca ketiga sumber temuan.
 *
 * Kegagalan per-sumber TIDAK lagi ditelan diam-diam. Sebelumnya semua error
 * dipetakan ke `[]`, sehingga backend mati tampil sebagai "Tidak ada temuan
 * terbuka. Semua sudah ditangani." — false all-clear pada alat monitoring.
 * Sekarang sumber yang gagal dikembalikan lewat `gagal[]` supaya UI bisa
 * membedakan "tidak ada temuan" dari "tidak bisa dibaca".
 */
async function loadSemuaAnomali() {
  const hasil = await Promise.allSettled([
    apiLoad('tower_anomali_log'),
    apiLoad('kondisi_log'),
    apiLoad('jaring_kerusakan_log')
  ]);

  const gagal = [];
  const isi = hasil.map((h, i) => {
    if (h.status === 'fulfilled' && Array.isArray(h.value)) return h.value;
    gagal.push({
      sumber: SUMBER[i].key,
      label: SUMBER[i].label,
      pesan: (h.reason && h.reason.message) || 'Gagal memuat'
    });
    return [];
  });

  const [tw, pr, jr] = isi;

  const out = [
    ...tw.filter((r) => r && r.id_tower).map(normalTower),
    ...pr.filter((r) => r && r.id_peralatan).map(normalPeralatan),
    ...jr.filter((r) => r && r.id_jaring).map(normalJaring)
  ];

  // Untuk peralatan & jaring, satu baris 'normal' menutup temuan sebelumnya
  // pada objek yang sama. Riwayatnya tetap disimpan, hanya statusnya berubah.
  const penutup = {};
  out.forEach((a) => {
    if (a.status === 'selesai' && a.sumber !== 'tower') {
      const k = a.sumber + '|' + a.objek;
      if (!penutup[k] || a.timestamp > penutup[k]) penutup[k] = a.timestamp;
    }
  });
  out.forEach((a) => {
    if (a.status === 'terbuka' && a.sumber !== 'tower') {
      const k = a.sumber + '|' + a.objek;
      if (penutup[k] && penutup[k] > a.timestamp) a.status = 'selesai';
    }
  });

  const daftar = out.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  // Properti non-enumerable: pemanggil lama yang memperlakukan hasil ini
  // sebagai array biasa tetap jalan, sementara UI baru bisa membaca `gagal`.
  Object.defineProperty(daftar, 'gagal', { value: gagal, enumerable: false });
  return daftar;
}

/** Umur temuan dalam hari; null kalau timestamp tidak valid. */
function umurHari(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function ringkasAnomali(list) {
  const terbuka = list.filter((a) => a.status === 'terbuka');
  const perSumber = {};
  terbuka.forEach((a) => { perSumber[a.sumber] = (perSumber[a.sumber] || 0) + 1; });

  const umur = terbuka.map((a) => umurHari(a.timestamp)).filter((u) => u !== null);
  return {
    total: list.length,
    terbuka: terbuka.length,
    selesai: list.length - terbuka.length,
    parah: terbuka.filter((a) => a.tingkat === 'parah').length,
    perSumber,
    tertua: umur.length ? Math.max(...umur) : null,
    lebih30: umur.filter((u) => u > 30).length
  };
}

/** Jumlah temuan per bulan, untuk grafik tren sederhana. */
function trenBulanan(list, jumlahBulan) {
  const n = jumlahBulan || 12;
  const kunci = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const bulan = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bulan.push({ kunci: kunci(d), label: d.toLocaleDateString('id-ID', { month: 'short' }), jumlah: 0 });
  }
  const indeks = {};
  bulan.forEach((b, i) => { indeks[b.kunci] = i; });
  list.forEach((a) => {
    const d = new Date(a.timestamp);
    if (isNaN(d)) return;
    const i = indeks[kunci(d)];
    if (i !== undefined) bulan[i].jumlah++;
  });
  return bulan;
}
