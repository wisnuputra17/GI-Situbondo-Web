/**
 * shared/api.js
 * Wrapper komunikasi ke backend Apps Script (Sheets + Drive).
 * Ganti CONFIG.API_URL setelah deploy Web App (lihat README.md).
 */

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxg89FSeJg0VxpAuRfJn8FiDZE72loPoqML4O3B7cCkyJl8KBjqJRup8hVD-2PVdKyXrQ/exec'
};

const PW_KEY = 'pln_gi_pw';

function getPassword() {
  return sessionStorage.getItem(PW_KEY) || '';
}

function setPassword(pw) {
  sessionStorage.setItem(PW_KEY, pw);
}

function clearPassword() {
  sessionStorage.removeItem(PW_KEY);
}

/**
 * Pastikan sudah "login". Dipanggil di awal setiap halaman modul.
 * rootPrefix = jarak relatif halaman ini ke root proyek ('' atau '../../').
 */
function requireAuth(rootPrefix = '') {
  if (!getPassword()) {
    window.location.replace(rootPrefix + 'index.html');
    return false;
  }
  return true;
}

function logout(rootPrefix = '') {
  clearPassword();
  window.location.replace(rootPrefix + 'index.html');
}

/** Uji satu kode akses ke backend tanpa menyimpannya. */
async function verifyPassword(pw) {
  const params = new URLSearchParams({ action: 'load', sheet: 'profil_gi', password: pw });
  const res = await fetch(`${CONFIG.API_URL}?${params.toString()}`);
  const json = await res.json();
  if (json.ok) return { ok: true };
  return { ok: false, error: json.error || 'Kode akses ditolak' };
}

function handleAuthFailure(err) {
  if (/password/i.test(err || '')) {
    clearPassword();
    // rootPrefix tidak diketahui di sini; pakai path absolut dari root situs
    const base = window.location.pathname.split('/').slice(0, 2).join('/');
    window.location.replace(`${base}/index.html`);
  }
}

async function apiGet(action, extraParams = {}) {
  const params = new URLSearchParams({ action, password: getPassword(), ...extraParams });
  const res = await fetch(`${CONFIG.API_URL}?${params.toString()}`);
  const json = await res.json();
  if (!json.ok) {
    handleAuthFailure(json.error);
    throw new Error(json.error || 'Request gagal');
  }
  return json.data;
}

async function apiPost(action, payload = {}) {
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight
    body: JSON.stringify({ action, password: getPassword(), ...payload })
  });
  const json = await res.json();
  if (!json.ok) {
    handleAuthFailure(json.error);
    throw new Error(json.error || 'Request gagal');
  }
  return json.data;
}

// ---------- Kontrak API data terstruktur (Sheets) ----------
const apiLoad = (sheet) => apiGet('load', { sheet });
const apiSave = (sheet, rows) => apiPost('save', { sheet, payload: rows });
const apiAppend = (sheet, row) => apiPost('append', { sheet, payload: row });
const apiClear = (sheet) => apiPost('clear', { sheet });

// ---------- Kontrak API file (Drive) ----------
const apiListFiles = (path) => apiGet('listFiles', { path });
const apiUploadFile = (path, fileName, mimeType, base64) =>
  apiPost('uploadFile', { path, fileName, mimeType, base64 });

async function apiPing() {
  try {
    const res = await fetch(`${CONFIG.API_URL}?action=ping`);
    const json = await res.json();
    return !!json.ok;
  } catch (e) {
    return false;
  }
}
