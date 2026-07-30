/**
 * features/peta-tower/db.js
 * Logic akses data untuk modul Peta & Tower.
 * Semua fungsi di sini cuma memanggil kontrak shared/api.js — tidak ada
 * markup/DOM di file ini, supaya UI (index.html) dan data terpisah rapi.
 */

const GI_ID_DEFAULT = 'GI-STB-01';

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
  // hanya 1 baris yang diharapkan → overwrite penuh lebih aman daripada append berulang
  await apiSave('profil_gi', [payload]);
  return payload;
}

async function loadTowers() {
  return apiLoad('tower_master');
}

async function addTower(tower) {
  const payload = { ...tower, updated_at: new Date().toISOString() };
  await apiAppend('tower_master', payload);
  return payload;
}

async function updateTowerStatus(idTower, newStatus) {
  const towers = await loadTowers();
  const updated = towers.map((t) =>
    t.id_tower === idTower ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
  );
  await apiSave('tower_master', updated);
  return updated;
}
