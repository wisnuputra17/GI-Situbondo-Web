/**
 * shared/api.js
 * Wrapper komunikasi ke backend Apps Script (Sheets + Drive).
 * Ganti CONFIG.API_URL setelah deploy Web App (lihat README.md).
 */

const CONFIG = {
  API_URL: 'PASTE_URL_WEB_APP_DI_SINI' // contoh: https://script.google.com/macros/s/XXXX/exec
};

function getPassword() {
  let pw = sessionStorage.getItem('pln_gi_pw');
  if (!pw) {
    pw = window.prompt('Masukkan kode akses:') || '';
    sessionStorage.setItem('pln_gi_pw', pw);
  }
  return pw;
}

function clearPassword() {
  sessionStorage.removeItem('pln_gi_pw');
}

async function apiGet(action, extraParams = {}) {
  const params = new URLSearchParams({ action, password: getPassword(), ...extraParams });
  const res = await fetch(`${CONFIG.API_URL}?${params.toString()}`);
  const json = await res.json();
  if (!json.ok) {
    if (/password/i.test(json.error || '')) clearPassword();
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
    if (/password/i.test(json.error || '')) clearPassword();
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
