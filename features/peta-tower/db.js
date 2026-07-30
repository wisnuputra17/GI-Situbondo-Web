/**
 * features/peta-tower/db.js
 * Logic akses data modul Peta & Tower. Tidak ada markup/DOM di file ini —
 * semua lewat kontrak shared/api.js.
 */

const GI_ID_DEFAULT = 'GI-STB-01';

// ---------- Profil GI ----------
async function loadGIProfile() {
  const rows = await apiLoad('profil_gi');
  return rows[0] || null; // proyek ini hanya untuk 1 GI (GI Situbondo)
}

async function saveGIProfile(data) {
  const payload = {
    id_gi: GI_ID_DEFAULT,
    nama_gi: 'GI Situbondo',
    ...data,
    updated_at: new Date().toISOString()
  };
  await apiSave('profil_gi', [payload]);
  return payload;
}

// ---------- Tower ----------
async function loadTowers() {
  const rows = await apiLoad('tower_master');
  return rows
    .filter((t) => t.id_tower)
    .map((t) => ({
      ...t,
      // `jalur` = nama kolom skema lama; dipertahankan sebagai fallback supaya
      // sheet dengan header lama tidak membuat halaman gagal total.
      penghantar: t.penghantar || t.jalur || '(tanpa penghantar)',
      alamat: t.alamat || '',
      ground_patrol: t.ground_patrol || '',
      status: t.status || 'normal',
      nomor: Number(t.nomor) || 0,
      lat: Number(t.lat),
      lng: Number(t.lng)
    }))
    .sort((a, b) => String(a.penghantar).localeCompare(String(b.penghantar)) || a.nomor - b.nomor);
}

/**
 * Isi tower_master dari TOWER_SEED (tower-seed.js) — dipakai sekali saat
 * setup awal, supaya tidak perlu menyentuh spreadsheet secara manual.
 * Menimpa seluruh isi sheet, jadi konfirmasi dulu di UI sebelum dipanggil.
 */
async function seedTowers() {
  if (typeof TOWER_SEED === 'undefined') throw new Error('tower-seed.js belum ter-load');
  const stamped = TOWER_SEED.map((t) => ({ ...t, updated_at: new Date().toISOString() }));
  await apiSave('tower_master', stamped);

  // Verifikasi: Apps Script menulis berdasarkan SHEET_HEADERS miliknya sendiri.
  // Kalau Code.gs masih skema lama, kolom penghantar/nomor/alamat/ground_patrol
  // akan hilang TANPA memunculkan error — jadi harus dicek eksplisit.
  const after = await apiLoad('tower_master');
  const schemaOk = after.length > 0 && Object.prototype.hasOwnProperty.call(after[0], 'penghantar');
  return { count: stamped.length, written: after.length, schemaOk };
}

async function updateTowerStatus(idTower, newStatus) {
  const towers = await loadTowers();
  const updated = towers.map((t) =>
    t.id_tower === idTower ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
  );
  await apiSave('tower_master', updated);
  return updated;
}

// ---------- Anomali tower ----------
async function loadTowerAnomalies() {
  return apiLoad('tower_anomali_log');
}

async function addTowerAnomaly({ id_tower, jenis_anomali, catatan, oleh }) {
  const row = {
    timestamp: new Date().toISOString(),
    id_tower,
    jenis_anomali,
    catatan: catatan || '',
    status: 'open',
    oleh: oleh || 'Wisnu'
  };
  await apiAppend('tower_anomali_log', row);
  await updateTowerStatus(id_tower, 'anomali');
  return row;
}

async function resolveTowerAnomalies(idTower) {
  const logs = await loadTowerAnomalies();
  const updated = logs.map((l) =>
    l.id_tower === idTower && l.status === 'open' ? { ...l, status: 'resolved' } : l
  );
  await apiSave('tower_anomali_log', updated);
  await updateTowerStatus(idTower, 'normal');
  return updated;
}

/** Riwayat anomali terbuka, dikelompokkan per id_tower. */
function groupOpenAnomalies(logs) {
  const map = {};
  logs.filter((l) => l.status === 'open').forEach((l) => {
    if (!map[l.id_tower]) map[l.id_tower] = [];
    map[l.id_tower].push(l);
  });
  return map;
}
