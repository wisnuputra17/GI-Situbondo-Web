/**
 * features/data-peralatan/db.js
 * Logika data modul Data Peralatan (daftar induk peralatan GI + riwayat kondisi).
 * Hanya memanggil kontrak shared/api.js — tanpa DOM.
 */

/** Jenis peralatan yang umum ada di GI 150 kV. 'Lain-lain' untuk yang tidak terdaftar. */
const JENIS_PERALATAN = [
  'Transformator Daya',
  'PMT (Circuit Breaker)',
  'PMS (Disconnecting Switch)',
  'PMS Tanah (Earthing Switch)',
  'CT (Current Transformer)',
  'PT / VT (Voltage Transformer)',
  'LA (Lightning Arrester)',
  'Busbar',
  'Kubikel 20 kV',
  'Trafo Pemakaian Sendiri',
  'NGR (Neutral Grounding Resistor)',
  'Baterai & Rectifier',
  'Panel Kontrol / Proteksi',
  'Relai Proteksi',
  'Kompresor',
  'Kabel Power',
  'Lain-lain'
];

/** Status peralatan. Kunci dipakai di data, label untuk tampilan. */
const STATUS_PERALATAN = [
  { key: 'normal', label: 'Normal' },
  { key: 'perhatian', label: 'Perlu perhatian' },
  { key: 'rusak', label: 'Rusak' },
  { key: 'nonaktif', label: 'Non-aktif' }
];

// ---------- Daftar induk peralatan ----------
async function loadPeralatan() {
  const rows = await apiLoad('peralatan_master');
  return rows
    .filter((r) => r && r.id_peralatan)
    .map((r) => ({
      id_peralatan: String(r.id_peralatan),
      jenis: r.jenis || 'Lain-lain',
      bay: r.bay || '',
      merk: r.merk || '',
      tipe: r.tipe || '',
      no_seri: r.no_seri || '',
      kapasitas: r.kapasitas || '',
      tahun_pasang: r.tahun_pasang || '',
      status: r.status || 'normal',
      catatan: r.catatan || '',
      updated_at: r.updated_at || ''
    }))
    .sort((a, b) =>
      a.jenis.localeCompare(b.jenis) ||
      String(a.bay).localeCompare(String(b.bay)) ||
      a.id_peralatan.localeCompare(b.id_peralatan)
    );
}

async function addPeralatan(data) {
  const row = { ...data, updated_at: new Date().toISOString() };
  await apiAppend('peralatan_master', row);
  return row;
}

async function updatePeralatan(idAsal, data) {
  const all = await loadPeralatan();
  const updated = all.map((p) =>
    p.id_peralatan === idAsal ? { ...p, ...data, updated_at: new Date().toISOString() } : p
  );
  await apiSave('peralatan_master', updated);
  return updated;
}

async function deletePeralatan(id) {
  const all = await loadPeralatan();
  await apiSave('peralatan_master', all.filter((p) => p.id_peralatan !== id));
}

/**
 * Impor massal dari tempelan spreadsheet (TSV/CSV).
 * Kolom yang diharapkan berurutan:
 *   id_peralatan, jenis, bay, merk, tipe, no_seri, kapasitas, tahun_pasang, status
 * Baris yang id-nya kosong dilewati. Mode 'tambah' menyisipkan tanpa menghapus
 * data lama; mode 'ganti' menimpa seluruh isi sheet.
 */
function parseTempelan(teks) {
  const baris = String(teks).trim().split(/\r?\n/).filter((b) => b.trim());
  const hasil = [];
  const ditolak = [];

  baris.forEach((b, i) => {
    const kol = b.includes('\t') ? b.split('\t') : b.split(',');
    const id = (kol[0] || '').trim();
    if (!id) { ditolak.push({ baris: i + 1, alasan: 'ID kosong' }); return; }
    // lewati baris header kalau terbawa
    if (/^id[_ ]?peralatan$/i.test(id)) return;

    const jenisMentah = (kol[1] || '').trim();
    const jenis = JENIS_PERALATAN.find((j) => j.toLowerCase() === jenisMentah.toLowerCase())
      || JENIS_PERALATAN.find((j) => j.toLowerCase().startsWith(jenisMentah.toLowerCase().slice(0, 4)))
      || (jenisMentah ? 'Lain-lain' : 'Lain-lain');

    const statusMentah = (kol[8] || '').trim().toLowerCase();
    const status = STATUS_PERALATAN.some((s) => s.key === statusMentah) ? statusMentah : 'normal';

    hasil.push({
      id_peralatan: id,
      jenis,
      bay: (kol[2] || '').trim(),
      merk: (kol[3] || '').trim(),
      tipe: (kol[4] || '').trim(),
      no_seri: (kol[5] || '').trim(),
      kapasitas: (kol[6] || '').trim(),
      tahun_pasang: (kol[7] || '').trim(),
      status,
      catatan: ''
    });
  });

  return { hasil, ditolak };
}

async function imporPeralatan(rows, mode) {
  const stamped = rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
  if (mode === 'ganti') {
    await apiSave('peralatan_master', stamped);
    return stamped.length;
  }
  const lama = await loadPeralatan();
  const idLama = new Set(lama.map((p) => p.id_peralatan));
  const baru = stamped.filter((r) => !idLama.has(r.id_peralatan));
  await apiSave('peralatan_master', [...lama, ...baru]);
  return baru.length;
}

// ---------- Riwayat kondisi ----------
async function loadKondisiLog() {
  return apiLoad('kondisi_log');
}

async function addKondisi({ id_peralatan, kondisi, catatan, oleh }) {
  const row = {
    timestamp: new Date().toISOString(),
    id_peralatan,
    kondisi,
    catatan: catatan || '',
    oleh: oleh || 'Wisnu'
  };
  await apiAppend('kondisi_log', row);
  // status di daftar induk mengikuti hasil pemeriksaan terakhir
  await updatePeralatan(id_peralatan, { status: kondisi });
  return row;
}

/** Kelompokkan riwayat kondisi per id_peralatan, terbaru di depan. */
function groupKondisi(logs) {
  const map = {};
  logs.forEach((l) => {
    if (!l || !l.id_peralatan) return;
    const id = String(l.id_peralatan);
    if (!map[id]) map[id] = [];
    map[id].push(l);
  });
  Object.values(map).forEach((arr) =>
    arr.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
  );
  return map;
}

/** Ringkasan jumlah peralatan per jenis dan per status. */
function ringkasPeralatan(list) {
  const perJenis = {};
  const perStatus = { normal: 0, perhatian: 0, rusak: 0, nonaktif: 0 };
  list.forEach((p) => {
    perJenis[p.jenis] = (perJenis[p.jenis] || 0) + 1;
    if (perStatus[p.status] === undefined) perStatus[p.status] = 0;
    perStatus[p.status]++;
  });
  return { perJenis, perStatus, total: list.length };
}

// ---------- Util tampilan kartu ----------

/** Inisial untuk blok warna di kartu, diringkas dari nama jenis. */
function inisialJenis(jenis) {
  const khusus = {
    'PMT (Circuit Breaker)': 'PMT',
    'PMS (Disconnecting Switch)': 'PMS',
    'PMS Tanah (Earthing Switch)': 'PMS-T',
    'CT (Current Transformer)': 'CT',
    'PT / VT (Voltage Transformer)': 'PT',
    'LA (Lightning Arrester)': 'LA',
    'NGR (Neutral Grounding Resistor)': 'NGR',
    'Transformator Daya': 'TRF',
    'Trafo Pemakaian Sendiri': 'TPS',
    'Kubikel 20 kV': '20kV',
    'Baterai & Rectifier': 'BAT',
    'Panel Kontrol / Proteksi': 'PNL',
    'Relai Proteksi': 'RLY',
    'Kabel Power': 'KBL',
    'Kompresor': 'KMP',
    'Busbar': 'BUS',
    'Lain-lain': 'ETC'
  };
  if (khusus[jenis]) return khusus[jenis];
  return String(jenis || '?').split(/[\s\/]+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

/**
 * Warna blok kartu ditentukan dari nama jenis (hash sederhana), sehingga
 * satu jenis selalu mendapat warna yang sama tanpa perlu daftar manual.
 */
const PALET_BLOK = [
  ['#1e3a5f', '#7fb3ff'], ['#3d2a5c', '#c4a3ff'], ['#0f4034', '#5fe0b0'],
  ['#4a3212', '#fbbf24'], ['#4a1f2b', '#ff8fa8'], ['#173a3f', '#6fd6e0'],
  ['#3a3520', '#e0d06f'], ['#2b2f4a', '#a3b0ff'], ['#40241a', '#ffa07a']
];

function warnaBlok(kunci) {
  let h = 0;
  const t = String(kunci || '');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return PALET_BLOK[h % PALET_BLOK.length];
}

// ============================================================
//  JARING PENGAMAN (denah gardu induk)
//  Sumber denah: Denah_Jaring_Pengaman_EDITABLE.docx — 42 jaring
//  pada grid 8 baris x 9 kolom.
// ============================================================

/** Empat kondisi jaring, mengikuti kode warna pada denah asli. */
const KONDISI_JARING = [
  { key: 'normal', label: 'Normal',          warna: '#22a24d', teks: '#ffffff' },
  { key: 'ringan', label: 'Kerusakan ringan', warna: '#e0b520', teks: '#3a2c00' },
  { key: 'parah',  label: 'Kerusakan parah',  warna: '#cc2b2b', teks: '#ffffff' },
  { key: 'kosong', label: 'Belum terpasang',  warna: '#9aa3ad', teks: '#20262d' }
];

function warnaKondisi(k) {
  return KONDISI_JARING.find((x) => x.key === k) || KONDISI_JARING[3];
}

const JENIS_KERUSAKAN = [
  'Jaring sobek',
  'Simpul lepas',
  'Kawat sling kendor',
  'Kawat sling putus',
  'Tiang penyangga miring',
  'Tiang penyangga korosi',
  'Jaring lepas dari rangka',
  'Tertutup vegetasi',
  'Lain-lain'
];

async function loadJaring() {
  const rows = await apiLoad('jaring_master');
  return rows
    .filter((r) => r && r.id_jaring)
    .map((r) => ({
      id_jaring: String(r.id_jaring),
      baris: Number(r.baris) || 0,
      kolom: Number(r.kolom) || 0,
      bay: r.bay || '',
      ukuran: r.ukuran || '',
      samping: Number(r.samping) ? 1 : 0,
      kondisi: r.kondisi || 'kosong',
      tahun_pasang: r.tahun_pasang || '',
      catatan: r.catatan || '',
      updated_at: r.updated_at || ''
    }))
    .sort((a, b) => a.baris - b.baris || a.kolom - b.kolom);
}

/**
 * Isi jaring_master dari denah (JARING_SEED). Menimpa seluruh isi sheet.
 * Kondisi awal 'normal' — kondisi sebenarnya diisi lewat pemeriksaan di web.
 */
async function seedJaring(kondisiAwal) {
  if (typeof JARING_SEED === 'undefined') throw new Error('jaring-seed.js belum ter-load');
  const rows = JARING_SEED.map((j) => ({
    ...j, kondisi: kondisiAwal || 'normal', tahun_pasang: '', catatan: '',
    updated_at: new Date().toISOString()
  }));
  await apiSave('jaring_master', rows);
  const after = await apiLoad('jaring_master');
  const skemaOk = after.length > 0 && Object.prototype.hasOwnProperty.call(after[0], 'ukuran');
  return { count: rows.length, written: after.length, skemaOk };
}

async function updateJaring(id, data) {
  const all = await loadJaring();
  const updated = all.map((j) =>
    j.id_jaring === id ? { ...j, ...data, updated_at: new Date().toISOString() } : j
  );
  await apiSave('jaring_master', updated);
  return updated;
}

// ---------- Riwayat kerusakan ----------
async function loadKerusakanLog() {
  return apiLoad('jaring_kerusakan_log');
}

async function addKerusakan({ id_jaring, kondisi, jenis_kerusakan, catatan, oleh }) {
  const row = {
    timestamp: new Date().toISOString(),
    id_jaring,
    kondisi,
    jenis_kerusakan: jenis_kerusakan || '',
    catatan: catatan || '',
    oleh: oleh || 'Wisnu'
  };
  await apiAppend('jaring_kerusakan_log', row);
  await updateJaring(id_jaring, { kondisi });
  return row;
}

function groupKerusakan(logs) {
  const map = {};
  logs.forEach((l) => {
    if (!l || !l.id_jaring) return;
    const id = String(l.id_jaring);
    if (!map[id]) map[id] = [];
    map[id].push(l);
  });
  Object.values(map).forEach((a) =>
    a.sort((x, y) => String(y.timestamp).localeCompare(String(x.timestamp)))
  );
  return map;
}

// ---------- Usia jaring ----------

/** Usia dalam tahun dari tahun pasang; null kalau belum diisi. */
function usiaJaring(tahunPasang) {
  const t = parseInt(tahunPasang, 10);
  if (!t || t < 1900 || t > 2200) return null;
  return new Date().getFullYear() - t;
}

/**
 * Klasifikasi usia. Ambang ini perkiraan awal dan perlu disesuaikan
 * dengan standar pemeliharaan yang berlaku di unit.
 */
function statusUsia(tahun) {
  const u = usiaJaring(tahun);
  if (u === null) return { key: 'tidak-diketahui', label: 'Usia belum diisi', kelas: 'text-on-surface-variant' };
  if (u >= 10) return { key: 'tua', label: `${u} tahun — perlu peremajaan`, kelas: 'text-error' };
  if (u >= 7)  return { key: 'menengah', label: `${u} tahun — pantau`, kelas: 'text-tertiary' };
  return { key: 'baru', label: `${u} tahun`, kelas: 'text-secondary' };
}

/**
 * Deteksi data denah yang rusak: baris tanpa ukuran, atau banyak jaring
 * menempati satu sel yang sama. Keduanya gejala skema jaring_master di
 * Code.gs masih versi lama sehingga kolom denah terbuang saat penyimpanan.
 */
function denahRusak(list) {
  if (!list.length) return null;
  const tanpaUkuran = list.filter((j) => !j.ukuran).length;
  const sel = new Set(list.map((j) => j.baris + ',' + j.kolom));
  const tumpuk = list.length - sel.size;
  if (tanpaUkuran === 0 && tumpuk === 0) return null;
  return { tanpaUkuran, tumpuk, total: list.length };
}

/** Ringkasan kondisi & usia untuk panel statistik. */
function ringkasJaring(list) {
  const perKondisi = { normal: 0, ringan: 0, parah: 0, kosong: 0 };
  let perluRemaja = 0, adaUsia = 0;
  list.forEach((j) => {
    if (perKondisi[j.kondisi] === undefined) perKondisi[j.kondisi] = 0;
    perKondisi[j.kondisi]++;
    const u = usiaJaring(j.tahun_pasang);
    if (u !== null) { adaUsia++; if (u >= 10) perluRemaja++; }
  });
  return { perKondisi, perluRemaja, adaUsia, total: list.length };
}
