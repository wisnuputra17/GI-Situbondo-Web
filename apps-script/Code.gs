/**
 * PLN GI Suite — Backend (Google Apps Script)
 * ------------------------------------------------
 * Jembatan antara frontend (GitHub Pages) dengan Google Sheets (data
 * terstruktur) dan Google Drive (file WP/BA/Peralatan).
 *
 * SETUP (lihat README.md untuk detail lengkap):
 * 1. Buat Google Sheet baru, catat Spreadsheet ID-nya.
 * 2. Buat folder Drive di Shared Drive, catat Folder ID-nya.
 * 3. Project Settings > Script Properties, tambahkan:
 *      SPREADSHEET_ID  = <id sheet>
 *      ROOT_FOLDER_ID  = <id folder Drive root>
 *      ACCESS_PASSWORD = <kode akses yang disepakati tim>
 * 4. Deploy > New deployment > Web app
 *      Execute as     : Me
 *      Who has access : Anyone
 * 5. Salin URL /exec ke shared/api.js (CONFIG.API_URL)
 */

const SHEET_HEADERS = {
  profil_gi: ['id_gi', 'nama_gi', 'lokasi', 'lat', 'lng', 'tegangan', 'tahun_operasi', 'catatan', 'updated_at'],
  peralatan_master: ['id_peralatan', 'jenis', 'bay', 'merk', 'tipe', 'no_seri', 'kapasitas', 'tahun_pasang', 'status', 'catatan', 'updated_at'],
  kondisi_log: ['timestamp', 'id_peralatan', 'kondisi', 'catatan', 'oleh'],
  tower_master: ['id_tower', 'penghantar', 'nomor', 'lat', 'lng', 'alamat', 'ground_patrol', 'status', 'updated_at'],
  tower_anomali_log: ['timestamp', 'id_tower', 'jenis_anomali', 'catatan', 'status', 'oleh'],
  counter_log: ['timestamp', 'id_peralatan', 'jenis_counter', 'nilai', 'oleh'],
  jaring_master: ['id_jaring', 'penghantar', 'dari_menara', 'ke_menara', 'lokasi', 'panjang', 'tahun_pasang', 'kerawanan', 'status', 'catatan', 'updated_at'],
  anomali_log: ['timestamp', 'id_peralatan', 'deskripsi', 'status', 'oleh']
};

function doGet(e) {
  try {
    const params = e.parameter || {};
    if (params.action === 'ping') {
      return jsonOut({ ok: true, message: 'PLN GI Suite backend aktif' });
    }

    checkPassword(params.password);

    if (params.action === 'load') {
      return jsonOut({ ok: true, data: loadSheet(params.sheet) });
    }
    if (params.action === 'listFiles') {
      return jsonOut({ ok: true, data: listFiles(params.path || '') });
    }
    return jsonOut({ ok: false, error: 'Unknown action: ' + params.action });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    checkPassword(body.password);

    switch (body.action) {
      case 'save':
        saveSheet(body.sheet, body.payload || []);
        return jsonOut({ ok: true });
      case 'append':
        appendRow(body.sheet, body.payload || {});
        return jsonOut({ ok: true });
      case 'clear':
        clearSheet(body.sheet);
        return jsonOut({ ok: true });
      case 'uploadFile':
        const fileInfo = uploadFile(body.path, body.fileName, body.mimeType, body.base64);
        return jsonOut({ ok: true, data: fileInfo });
      case 'deleteFile':
        return jsonOut({ ok: true, data: deleteFile(body.fileId) });
      case 'renameFile':
        return jsonOut({ ok: true, data: renameFile(body.fileId, body.newName) });
      case 'createFolder':
        return jsonOut({ ok: true, data: createFolder(body.path, body.name) });
      case 'deleteFolder':
        return jsonOut({ ok: true, data: deleteFolder(body.folderId) });
      default:
        return jsonOut({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

// ---------- Auth ----------
function checkPassword(pw) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_PASSWORD');
  if (!expected) return; // belum di-set → mode development, lewati
  if (pw !== expected) {
    throw new Error('Password salah atau kosong');
  }
}

// ---------- Sheets helpers ----------
function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID belum diset di Script Properties');
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = SHEET_HEADERS[name];
    if (headers) sheet.appendRow(headers);
  }
  return sheet;
}

function loadSheet(name) {
  const sheet = getOrCreateSheet(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function saveSheet(name, rows) {
  const sheet = getOrCreateSheet(name);
  const headers = SHEET_HEADERS[name] || Object.keys(rows[0] || {});
  sheet.clearContents();
  sheet.appendRow(headers);
  if (rows.length) {
    const values = rows.map(r => headers.map(h => (r[h] !== undefined ? r[h] : '')));
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }
}

function appendRow(name, row) {
  const sheet = getOrCreateSheet(name);
  const headers = SHEET_HEADERS[name] || Object.keys(row);
  const values = headers.map(h => (row[h] !== undefined ? row[h] : ''));
  sheet.appendRow(values);
}

function clearSheet(name) {
  const sheet = getOrCreateSheet(name);
  const headers = SHEET_HEADERS[name];
  sheet.clearContents();
  if (headers) sheet.appendRow(headers);
}

// ---------- Drive helpers ----------
function getRootFolder() {
  const id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if (!id) throw new Error('ROOT_FOLDER_ID belum diset di Script Properties');
  return DriveApp.getFolderById(id);
}

function getOrCreateFolderByPath(path) {
  let folder = getRootFolder();
  if (!path) return folder;
  const parts = String(path).split('/').filter(Boolean);
  parts.forEach(part => {
    const existing = folder.getFoldersByName(part);
    folder = existing.hasNext() ? existing.next() : folder.createFolder(part);
  });
  return folder;
}

function listFiles(path) {
  const folder = getOrCreateFolderByPath(path);

  const folders = [];
  const fIter = folder.getFolders();
  while (fIter.hasNext()) {
    const sub = fIter.next();
    folders.push({ id: sub.getId(), name: sub.getName(), url: sub.getUrl() });
  }

  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const f = iter.next();
    files.push({
      id: f.getId(),
      name: f.getName(),
      url: f.getUrl(),
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + f.getId(),
      mimeType: f.getMimeType(),
      size: f.getSize(),
      updatedAt: f.getLastUpdated()
    });
  }

  return { path: path || '', folders: folders, files: files };
}

function createFolder(path, name) {
  const parent = getOrCreateFolderByPath(path);
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) {
    const f = existing.next();
    return { id: f.getId(), name: f.getName(), existed: true };
  }
  const f = parent.createFolder(name);
  return { id: f.getId(), name: f.getName(), existed: false };
}

/** Pindahkan file ke Trash (bukan hapus permanen) supaya masih bisa dipulihkan. */
function deleteFile(fileId) {
  const file = DriveApp.getFileById(fileId);
  const name = file.getName();
  file.setTrashed(true);
  return { id: fileId, name: name, trashed: true };
}

/**
 * Pindahkan folder ke Trash beserta seluruh isinya.
 * Root folder dilindungi agar tidak bisa terhapus.
 */
function deleteFolder(folderId) {
  const rootId = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if (folderId === rootId) throw new Error('Folder root tidak boleh dihapus');

  const folder = DriveApp.getFolderById(folderId);
  const name = folder.getName();

  // hitung isi supaya UI bisa memberi peringatan yang akurat
  let fileCount = 0;
  const it = folder.getFiles();
  while (it.hasNext()) { it.next(); fileCount++; }

  folder.setTrashed(true);
  return { id: folderId, name: name, fileCount: fileCount, trashed: true };
}

function renameFile(fileId, newName) {
  const file = DriveApp.getFileById(fileId);
  file.setName(newName);
  return { id: fileId, name: newName };
}

function uploadFile(path, fileName, mimeType, base64) {
  const folder = getOrCreateFolderByPath(path);
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const file = folder.createFile(blob);
  return { id: file.getId(), name: file.getName(), url: file.getUrl() };
}

// ---------- Output ----------
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
