# GitHub Database Setup Guide

## 🚀 **Quick Setup (5 menit)**

### **Step 1: Generate GitHub Personal Access Token**

1. Buka: https://github.com/settings/tokens/new
2. **Note:** `GI Situbondo Web - Apps Script Sync`
3. **Expiration:** `No expiration` (atau `1 year`)
4. **Scopes:** Centang `repo` (Full control of private repositories)
   - ✅ `repo:status`
   - ✅ `repo_deployment`
   - ✅ `public_repo`
   - ✅ `repo:invite`
   - ✅ `security_events`
5. Klik **Generate token**
6. **COPY TOKEN** sekarang! (format: `ghp_xxxxxxxxxxxxxxxxxxxxx`)
   - ⚠️ Token hanya muncul sekali, simpan di tempat aman

---

### **Step 2: Add Token ke Apps Script**

1. Buka Apps Script Editor:
   ```
   https://script.google.com/home/projects/1POZCOaEbPhA1QyVHkvugUH0vaU3CYmTQnzjc9MzGJ_1mk_X97NoVTvnA/edit
   ```

2. **Project Settings** (⚙️ icon di sidebar kiri)

3. **Script Properties** → Klik **Add script property**

4. Tambahkan property baru:
   - **Property:** `GITHUB_TOKEN`
   - **Value:** Paste token yang di-copy tadi (`ghp_xxxxxxxxxxxxxxxxxxxxx`)
   - Klik **Save script properties**

---

### **Step 3: Setup Sync Trigger (Run Once)**

1. Di Apps Script Editor, pilih function: `createSyncTrigger`

2. Klik **Run** (▶️)

3. **Authorization popup** muncul → Klik **Review permissions**

4. Pilih akun: `gisitubondo1987@gmail.com`

5. **Google hasn't verified this app** → Klik **Advanced** → **Go to PLN GI Suite (unsafe)**

6. Klik **Allow**

7. Check **Execution log** (Ctrl/Cmd + Enter):
   ```
   ✅ Sync trigger created (every 5 min)
   ```

---

### **Step 4: Test Manual Sync**

1. Pilih function: `manualSyncAllToGitHub`

2. Klik **Run** (▶️)

3. Check **Execution log**:
   ```
   🚀 Manual sync: tower_master, kerawanan_log, profil_gi
   📖 Loading tower_master from Sheets...
   ✅ Current SHA: abc123...
   ✅ Synced tower_master to GitHub
   📖 Loading kerawanan_log from Sheets...
   ✅ Synced kerawanan_log to GitHub
   📖 Loading profil_gi from Sheets...
   ✅ Synced profil_gi to GitHub
   ```

4. **Verify di GitHub:**
   ```
   https://github.com/wisnuputra17/GI-Situbondo-Web/commits/main
   ```
   
   Harus ada commit baru:
   ```
   Auto-sync tower_master - 2026-09-29T15:45:00.000Z
   Auto-sync kerawanan_log - 2026-09-29T15:45:05.000Z
   Auto-sync profil_gi - 2026-09-29T15:45:10.000Z
   ```

---

## ✅ **Verifikasi Setup**

### **1. Check Trigger Active:**

**Apps Script:** Triggers (⏰ icon di sidebar)

Harus ada trigger:
- **Function:** `scheduledSyncToGitHub`
- **Event source:** Time-driven
- **Type:** Minutes timer
- **Interval:** Every 5 minutes

### **2. Check GitHub Commits:**

Buka: https://github.com/wisnuputra17/GI-Situbondo-Web/commits/main

Setiap 5 menit (kalau ada perubahan), harus ada commit otomatis.

### **3. Test End-to-End:**

1. **Buka web:** https://wisnuputra17.github.io/GI-Situbondo-Web/features/peta-tower/

2. **Login:** `Situbondo1987`

3. **Open DevTools Console** (F12)

4. Lihat log:
   ```
   📖 Loading tower_master from GitHub...
   ✅ Cache HIT: tower_master.json (45s old)
   📖 Loading kerawanan_log from GitHub...
   ✅ Loaded kerawanan_log.json: 490 entries
   ```

5. **Add kerawanan baru** (klik tower → Catat Kerawanan)

6. Submit form → lihat console:
   ```
   ✅ Kerawanan saved to Apps Script
   📋 Added to sync queue: kerawanan_log
   ```

7. **Wait 5 menit** → Refresh halaman → kerawanan baru muncul (sudah di GitHub)

---

## 🔧 **Troubleshooting**

### **Error: "GITHUB_TOKEN not set"**

**Solution:**
- Double-check Script Properties (`GITHUB_TOKEN` ada?)
- Re-save token (copy-paste ulang)
- Pastikan no typo

### **Error: "GitHub PUT failed: 401"**

**Solution:**
- Token expired atau invalid
- Generate token baru
- Update Script Properties

### **Error: "GitHub PUT failed: 422"**

**Solution:**
- File sudah di-modify di GitHub (conflict)
- Run `manualSyncAllToGitHub()` untuk force sync

### **Trigger tidak jalan**

**Solution:**
- Check quota: https://script.google.com/home/executions
- Delete & re-create trigger
- Check timezone di Project Settings

---

## 📊 **Monitoring**

### **Execution Logs:**

**Apps Script:** Executions (📝 icon di sidebar)

Filter: `scheduledSyncToGitHub`

Lihat logs tiap 5 menit.

### **GitHub Commits:**

```bash
# Via terminal
cd ~/GI-Situbondo-Web
git log --oneline --grep="Auto-sync" -10
```

### **Cache Info (Browser Console):**

```javascript
// Check cache status
getGitHubCacheInfo()

// Clear cache
clearGitHubCache()

// Force refresh
await apiLoad('tower_master', true) // forceAppsScript = true
```

---

## 🎯 **Performance Metrics**

| Metric | Before (Sheets) | After (Hybrid) |
|--------|----------------|----------------|
| **Page load** | 3-5s | 0.5-1s |
| **Tower data** | 2000-5000ms | 50-200ms |
| **Kerawanan** | 2000-5000ms | 50-200ms |
| **Submit peminjaman** | 1000ms | 500ms |
| **Data freshness** | Instant | Max 5 min |

---

## 📝 **Notes**

- **Sync trigger** runs every 5 minutes (default)
- **Sync queue** reset on Apps Script cold start (every ~30 min idle)
- **GitHub rate limit:** 5000 requests/hour (authenticated)
- **Cache duration:** 5 minutes (configurable di `api-github.js`)

---

✅ **Setup complete!** GitHub database sekarang aktif dengan auto-sync.
