/**
 * shared/gi-data.js
 * Akses data GI/tower/anomali yang dipakai LEBIH DARI SATU modul
 * (Dashboard, Peta & Tower, dan nanti modul Anomali).
 *
 * Logika yang khusus satu modul saja tetap tinggal di features/[modul]/db.js.
 * Semua fungsi di sini hanya memanggil kontrak shared/api.js — tanpa DOM.
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
    .filter((t) => t && t.id_tower)
    .map((t) => ({
      ...t,
      // `jalur` = nama kolom skema lama; fallback supaya sheet berheader lama
      // tidak membuat halaman gagal total.
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

/** Anomali yang masih terbuka, dikelompokkan per id_tower. */
function groupOpenAnomalies(logs) {
  const map = {};
  logs.filter((l) => l.status === 'open').forEach((l) => {
    if (!map[l.id_tower]) map[l.id_tower] = [];
    map[l.id_tower].push(l);
  });
  return map;
}

/** Ringkasan per penghantar: jumlah tower & anomali. */
function summarizeByPenghantar(towers) {
  const out = {};
  towers.forEach((t) => {
    if (!out[t.penghantar]) out[t.penghantar] = { total: 0, anomali: 0 };
    out[t.penghantar].total++;
    if (t.status === 'anomali') out[t.penghantar].anomali++;
  });
  return out;
}
