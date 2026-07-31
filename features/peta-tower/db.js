/**
 * features/peta-tower/db.js
 * Logika data yang KHUSUS modul Peta & Tower.
 * Fungsi yang dipakai bersama modul lain (loadTowers, anomali, profil GI)
 * ada di shared/gi-data.js.
 */

/**
 * Isi tower_master dari TOWER_SEED (tower-seed.js) — dipakai sekali saat
 * setup awal, supaya tidak perlu menyentuh spreadsheet secara manual.
 * Menimpa seluruh isi sheet, jadi harus dikonfirmasi dulu di UI.
 */
async function seedTowers() {
  if (typeof TOWER_SEED === 'undefined') throw new Error('tower-seed.js belum ter-load');
  const stamped = TOWER_SEED.map((t) => ({ ...t, updated_at: new Date().toISOString() }));
  await apiSave('tower_master', stamped);

  // Verifikasi wajib: Apps Script menulis berdasarkan SHEET_HEADERS miliknya
  // sendiri. Kalau Code.gs masih skema lama, kolom penghantar/nomor/alamat/
  // ground_patrol hilang TANPA memunculkan error — harus dicek eksplisit.
  const after = await apiLoad('tower_master');
  const schemaOk = after.length > 0 && Object.prototype.hasOwnProperty.call(after[0], 'penghantar');
  return { count: stamped.length, written: after.length, schemaOk };
}
