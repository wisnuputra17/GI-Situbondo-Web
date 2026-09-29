/**
 * jarak-gangguan.js
 * Fitur hitung jarak antar tower dan identifikasi tower di antara gangguan SUTT
 */

let distancePanel = null;
let distanceLine = null;

/**
 * Tambahkan panel UI untuk fitur jarak & gangguan
 */
function addDistancePanel() {
  // Cek apakah panel sudah ada
  if (document.getElementById('distance-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'distance-panel';
  panel.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-surface-container/98 backdrop-blur rounded-xl p-4 shadow-xl max-w-md z-[1000] border border-outline-variant/40';
  panel.innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-xs font-bold text-on-surface uppercase">📏 Jarak & Gangguan SUTT</h3>
      <button id="btn-close-distance" class="text-on-surface-variant hover:text-on-surface">
        <span class="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
    
    <div class="space-y-2">
      <div>
        <label class="block text-[10px] font-bold text-on-surface uppercase mb-1">Jarak Gangguan dari GI (meter)</label>
        <input type="number" id="dist-gangguan" class="w-full border border-outline-variant/40 rounded px-3 py-2 text-sm" placeholder="Contoh: 1500">
      </div>
      
      <button id="btn-cari-tower" class="w-full bg-primary text-on-primary py-2 rounded text-sm font-bold hover:bg-primary/90 transition">
        Cari Tower Terdekat
      </button>
    </div>
    
    <div id="dist-result" class="mt-3 hidden"></div>
  `;
  
  document.body.appendChild(panel);
  
  // Event listeners
  document.getElementById('btn-close-distance').addEventListener('click', () => {
    panel.remove();
    clearDistanceLine();
  });
  
  document.getElementById('btn-cari-tower').addEventListener('click', cariTowerTerdekat);
}

/**
 * Formula Haversine untuk hitung jarak antar 2 koordinat (dalam meter)
 */
function hitungJarak(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Cari tower yang berada pada jarak tertentu dari GI
 */
async function cariTowerTerdekat() {
  const jarakInput = document.getElementById('dist-gangguan');
  const jarakGangguan = parseInt(jarakInput.value);
  
  if (!jarakGangguan || jarakGangguan <= 0) {
    alert('Masukkan jarak gangguan yang valid (dalam meter)');
    return;
  }
  
  const resultDiv = document.getElementById('dist-result');
  resultDiv.innerHTML = '<p class="text-xs text-on-surface-variant">Mencari tower...</p>';
  resultDiv.classList.remove('hidden');
  
  try {
    // Ambil posisi GI
    const giProfile = await loadGIProfile();
    const giLat = parseFloat(giProfile.lat);
    const giLng = parseFloat(giProfile.lng);
    
    // Ambil semua tower
    const towers = allTowers || []; // Gunakan data tower yang sudah di-load
    
    if (towers.length === 0) {
      resultDiv.innerHTML = '<p class="text-xs text-error">Data tower belum dimuat</p>';
      return;
    }
    
    // Hitung jarak setiap tower dari GI
    const towersWithDistance = towers.map(t => ({
      ...t,
      jarakDariGI: hitungJarak(giLat, giLng, parseFloat(t.lat), parseFloat(t.lng))
    }));
    
    // Cari tower terdekat dengan jarak gangguan (toleransi ±200m)
    const toleransi = 200;
    const towerTerdekat = towersWithDistance.filter(t => 
      Math.abs(t.jarakDariGI - jarakGangguan) <= toleransi
    ).sort((a, b) => Math.abs(a.jarakDariGI - jarakGangguan) - Math.abs(b.jarakDariGI - jarakGangguan));
    
    if (towerTerdekat.length === 0) {
      resultDiv.innerHTML = `
        <div class="p-3 rounded bg-error/10 border border-error/20">
          <p class="text-sm font-bold text-error">Tidak ada tower dalam radius ±${toleransi}m dari jarak ${jarakGangguan}m</p>
          <p class="text-xs text-on-surface-variant mt-1">Tower terdekat: ${towersWithDistance.sort((a, b) => Math.abs(a.jarakDariGI - jarakGangguan) - Math.abs(b.jarakDariGI - jarakGangguan))[0].nomor} (${towersWithDistance[0].jarakDariGI}m dari GI)</p>
        </div>
      `;
      return;
    }
    
    // Ambil tower terbaik
    const tower = towerTerdekat[0];
    
    // Ambil kerawanan & anomali di tower ini
    const kerawanan = (allKerawanan || []).filter(k => k.id_tower === tower.id_tower);
    const anomali = (allAnomali || []).filter(a => a.id_tower === tower.id_tower);
    
    // Tampilkan hasil
    resultDiv.innerHTML = `
      <div class="p-3 rounded bg-surface-container-low space-y-2">
        <div class="pb-2 border-b border-outline-variant/40">
          <p class="text-xs font-bold text-on-surface">Tower Terdekat:</p>
          <p class="text-sm font-bold text-primary">${tower.id_tower}</p>
          <p class="text-xs text-on-surface-variant">Nomor: ${tower.nomor} | Penghantar: ${tower.penghantar}</p>
          <p class="text-xs text-on-surface-variant">Jarak dari GI: <span class="font-bold text-secondary">${tower.jarakDariGI}m</span> (gangguan di ${jarakGangguan}m)</p>
        </div>
        
        ${kerawanan.length > 0 ? `
          <div>
            <p class="text-xs font-bold text-on-surface mb-1">🚨 Kerawanan (${kerawanan.length}):</p>
            <div class="space-y-1">
              ${kerawanan.map(k => {
                const config = KERAWANAN_CONFIG[k.jenis] || {};
                return `
                  <div class="text-xs p-2 rounded bg-surface-container border border-outline-variant/20">
                    <span class="font-bold">${config.emoji || '⚠️'} ${config.label || k.jenis}</span>
                    <span class="text-on-surface-variant"> - ${k.tingkat}</span>
                    ${k.deskripsi ? `<p class="text-[10px] text-on-surface-variant mt-0.5">${k.deskripsi}</p>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : '<p class="text-xs text-on-surface-variant">✅ Tidak ada kerawanan tercatat</p>'}
        
        ${anomali.length > 0 ? `
          <div>
            <p class="text-xs font-bold text-on-surface mb-1">⚠️ Anomali (${anomali.length}):</p>
            <div class="space-y-1">
              ${anomali.map(a => `
                <div class="text-xs p-2 rounded bg-surface-container border border-outline-variant/20">
                  <span class="font-bold">${a.jenis_anomali}</span>
                  ${a.catatan ? `<p class="text-[10px] text-on-surface-variant mt-0.5">${a.catatan}</p>` : ''}
                  <p class="text-[9px] text-on-surface-variant mt-0.5">${new Date(a.timestamp).toLocaleString('id-ID')}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '<p class="text-xs text-on-surface-variant">✅ Tidak ada anomali tercatat</p>'}
      </div>
    `;
    
    // Highlight tower di peta
    highlightTowerOnMap(tower);
    
  } catch (error) {
    console.error('Error cari tower:', error);
    resultDiv.innerHTML = `<p class="text-xs text-error">Error: ${error.message}</p>`;
  }
}

/**
 * Highlight tower di peta dengan zoom & line dari GI
 */
function highlightTowerOnMap(tower) {
  if (!map) return;
  
  // Clear previous line
  clearDistanceLine();
  
  // Ambil posisi GI
  loadGIProfile().then(giProfile => {
    const giLat = parseFloat(giProfile.lat);
    const giLng = parseFloat(giProfile.lng);
    const towerLat = parseFloat(tower.lat);
    const towerLng = parseFloat(tower.lng);
    
    // Draw line dari GI ke tower
    distanceLine = L.polyline([
      [giLat, giLng],
      [towerLat, towerLng]
    ], {
      color: '#ef4444',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(map);
    
    // Zoom to fit line
    map.fitBounds(distanceLine.getBounds(), { padding: [50, 50] });
    
    // Open popup tower
    const marker = allMarkers.find(m => m.options.towerId === tower.id_tower);
    if (marker) {
      marker.openPopup();
    }
  }).catch(err => console.error('Error highlight tower:', err));
}

/**
 * Clear garis jarak di peta
 */
function clearDistanceLine() {
  if (distanceLine && map) {
    map.removeLayer(distanceLine);
    distanceLine = null;
  }
}

// Export functions untuk digunakan di index.html
if (typeof window !== 'undefined') {
  window.addDistancePanel = addDistancePanel;
  window.hitungJarak = hitungJarak;
  window.cariTowerTerdekat = cariTowerTerdekat;
  window.clearDistanceLine = clearDistanceLine;
}
