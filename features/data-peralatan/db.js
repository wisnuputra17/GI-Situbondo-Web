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
