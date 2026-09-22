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
  jaring_master: ['id_jaring', 'baris', 'kolom', 'bay', 'ukuran', 'samping', 'kondisi', 'tahun_pasang', 'catatan', 'updated_at'],
  jaring_kerusakan_log: ['timestamp', 'id_jaring', 'kondisi', 'jenis_kerusakan', 'catatan', 'oleh'],
  anomali_log: ['timestamp', 'id_peralatan', 'deskripsi', 'status', 'oleh'],
  personil_master: ['id_personil', 'nama', 'jabatan', 'updated_at'],
  alat_master: ['id_alat', 'nama_alat', 'kategori', 'kondisi', 'status', 'catatan', 'updated_at'],
  peminjaman_log: ['id_pinjam', 'id_alat', 'id_personil', 'status', 'tanggal_pinjam', 'foto_pinjam_url', 'catatan_pinjam', 'tanggal_kembali', 'foto_kembali_url', 'catatan_kembali']
};

function doGet(e) {
  try {
    const params = e.parameter || {};
    
    // Debug: show all properties (no password check)
    if (params.action === 'showProperties') {
      return jsonOut(showProperties());
    }
    
    // Setup endpoint: GET dengan parameter setup=telegram
    if (params.setup === 'telegram') {
      return jsonOut(setupTelegram());
    }
    
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
    
    // notifyTelegram bypass password check (notification, tidak modifikasi data)
    if (body.action === 'notifyTelegram') {
      return jsonOut({ ok: true, data: notifyTelegram(body.message) });
    }
    
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

// ---------- Notifikasi Telegram ----------
/**
 * Kirim pesan ke Telegram bot GI Situbondo. Token & chat ids disimpan di
 * Script Properties (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS) — bukan di kode
 * sumber, supaya tidak ikut ter-commit ke GitHub (sama seperti ACCESS_PASSWORD).
 * TELEGRAM_CHAT_IDS format: comma-separated list (e.g., "123456789,987654321,111222333")
 * Kegagalan kirim TIDAK melempar error ke pemanggil (peminjaman tetap
 * tersimpan walau notifikasi gagal) — hanya dicatat di return value.
 */
function notifyTelegram(message) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  const chatIdsStr = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_IDS');
  if (!token || !chatIdsStr) {
    return { sent: false, reason: 'TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_IDS belum diset di Script Properties' };
  }
  
  const chatIds = chatIdsStr.split(',').map(id => id.trim()).filter(Boolean);
  if (chatIds.length === 0) {
    return { sent: false, reason: 'TELEGRAM_CHAT_IDS kosong atau format salah' };
  }
  
  const results = [];
  chatIds.forEach(chatId => {
    try {
      const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        muteHttpExceptions: true
      });
      const body = JSON.parse(res.getContentText());
      results.push({ chatId: chatId, sent: !!body.ok, reason: body.ok ? '' : (body.description || 'gagal tanpa keterangan') });
    } catch (err) {
      results.push({ chatId: chatId, sent: false, reason: err.message });
    }
  });
  
  const allSent = results.every(r => r.sent);
  return { sent: allSent, results: results };
}

// ---------- Setup Properties ----------
/**
 * Fungsi setup otomatis: set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS, 
 * ACCESS_PASSWORD, dan bersihkan/initialize alat_master sheet.
 * Jalankan ini SEKALI via endpoint: ?setup=telegram
 */
function setupTelegram() {
  const props = PropertiesService.getScriptProperties();
  
  const token = '8910259474:AAH8Uvi3DDxUP95Gddkapsf3ytJ1o9b6qRk';
  const chatIds = '2138968822,6531471803';
  const accessPassword = 'Situbondo1987';
  
  props.setProperty('TELEGRAM_BOT_TOKEN', token);
  props.setProperty('TELEGRAM_CHAT_IDS', chatIds);
  props.setProperty('ACCESS_PASSWORD', accessPassword);
  
  // Bersihkan dan re-initialize alat_master sheet
  try {
    const sheet = getOrCreateSheet('alat_master');
    sheet.clearContents();
    const headers = SHEET_HEADERS['alat_master'];
    sheet.appendRow(headers);
    Logger.log('✅ alat_master sheet di-initialize dengan headers: ' + headers.join(', '));
  } catch (err) {
    Logger.log('⚠️  Gagal initialize alat_master: ' + err.message);
  }
  
  Logger.log('✅ Telegram & Access properties berhasil di-setup:');
  Logger.log('   TELEGRAM_BOT_TOKEN: ' + token.substring(0, 20) + '...');
  Logger.log('   TELEGRAM_CHAT_IDS: ' + chatIds);
  Logger.log('   ACCESS_PASSWORD: ' + accessPassword);
  
  return {
    ok: true,
    message: 'Properties & sheets setup berhasil',
    token: token.substring(0, 20) + '...',
    chatIds: chatIds,
    accessPassword: accessPassword
  };
}

// ---------- Setup Properties ----------
/**
 * Fungsi debug: show semua script properties yang sudah tersetting
 */
function showProperties() {
  const props = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();
  
  Logger.log('=== Script Properties ===');
  Logger.log(JSON.stringify(allProps, null, 2));
  
  return {
    ok: true,
    properties: allProps
  };
}

// ---------- Output ----------
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
