/**
 * features/file-manager/db.js
 * Logika data modul File WP/BA/Peralatan (Google Drive).
 * Hanya memanggil kontrak shared/api.js — tanpa DOM.
 */

/** Kategori utama = folder tingkat pertama di dalam ROOT_FOLDER_ID. */
const KATEGORI = [
  { id: 'WP', label: 'WP', icon: 'assignment', desc: 'Working Permit' },
  { id: 'BA', label: 'BA', icon: 'gavel', desc: 'Berita Acara' },
  { id: 'Peralatan', label: 'Peralatan', icon: 'precision_manufacturing', desc: 'Dokumen peralatan GI' },
  { id: 'Spreadsheet', label: 'Spreadsheet', icon: 'table_chart', desc: 'Data & rekap' }
];

/**
 * Batas ukuran unggah. Apps Script menerima payload lewat POST, dan base64
 * menggembungkan berkas ~33% — jadi batas praktis jauh di bawah limit Drive.
 * Berkas lebih besar sebaiknya diunggah langsung lewat Google Drive.
 */
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

async function listFolder(path) {
  const res = await apiListFiles(path);
  // backend lama mengembalikan array; backend baru mengembalikan objek
  if (Array.isArray(res)) return { path, folders: [], files: res, legacy: true };
  return { ...res, legacy: false };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.readAsDataURL(file);
  });
}

async function uploadOne(path, file) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} berukuran ${formatBytes(file.size)} — melebihi batas ${formatBytes(MAX_UPLOAD_BYTES)}`);
  }
  const base64 = await fileToBase64(file);
  return apiUploadFile(path, file.name, file.type || 'application/octet-stream', base64);
}

async function removeFile(fileId) {
  return apiDeleteFile(fileId);
}

async function makeFolder(path, name) {
  return apiCreateFolder(path, name);
}

// ---------- util tampilan ----------
function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function fileIconFor(mimeType, name) {
  const mt = String(mimeType || '');
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (mt.includes('pdf') || ext === 'pdf') return 'picture_as_pdf';
  if (mt.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(ext)) return 'table_chart';
  if (mt.includes('document') || ['doc', 'docx'].includes(ext)) return 'description';
  if (mt.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'slideshow';
  if (mt.startsWith('image/')) return 'image';
  if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip';
  return 'draft';
}
