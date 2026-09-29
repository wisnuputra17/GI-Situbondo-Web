/**
 * update-jarak-tower.js
 * Script untuk update kolom jarak_dari_gi di tower_master
 * Berdasarkan data TDS ULTG Jember 2025.xlsx
 */

// Data jarak dari Excel (extract manual)
const JARAK_TOWER_DATA = {
  "BONDOWOSO-SITUBONDO": {
    "penghantar": "BONDOWOSO-SITUBONDO",
    "total_towers": 109,
    "total_panjang_km": 34.8,
    "prefix": "BONDOWOSO-SITUBONDO",  // Untuk matching dengan tower_master
    "towers": [] // Will be populated from JSON
  },
  "PAITON-SITUBONDO": {
    "penghantar": "PAITON-SITUBONDO",
    "total_towers": 157,
    "total_panjang_km": 53.72,
    "prefix": "PAITON-SITUBONDO",
    "towers": []
  },
  "SITUBONDO-BANYUWANGI": {
    "penghantar": "SITUBONDO-BANYUWANGI",
    "total_towers": 281,
    "total_panjang_km": 87.18,
    "prefix": "STBDO-BWI",  // Sesuaikan dengan naming di tower_master
    "towers": []
  }
};

/**
 * Update tower dengan data jarak
 */
async function updateJarakTower() {
  try {
    // Load data tower dari backend
    const towers = await apiLoad('tower_master');
    console.log(`📊 Total ${towers.length} tower di database`);
    
    // Load data jarak dari JSON (yang sudah di-extract)
    const jarakData = await loadJarakData();
    
    if (!jarakData) {
      alert('Gagal load data jarak. Pastikan file JSON sudah tersedia.');
      return;
    }
    
    let updateCount = 0;
    const updatedTowers = towers.map(tower => {
      // Cari data jarak untuk tower ini berdasarkan penghantar & nomor
      const penghantar = tower.penghantar;
      const nomor = parseInt(tower.nomor);
      
      // Match penghantar
      let jarakInfo = null;
      for (const [key, data] of Object.entries(jarakData)) {
        if (penghantar.includes(data.prefix) || data.prefix.includes(penghantar)) {
          // Cari tower dengan nomor yang sama
          jarakInfo = data.towers.find(t => t.nomor === nomor);
          if (jarakInfo) break;
        }
      }
      
      if (jarakInfo) {
        updateCount++;
        return {
          ...tower,
          jarak_dari_gi: jarakInfo.jarak_dari_gi_m,
          span: jarakInfo.span_m
        };
      }
      
      return tower;
    });
    
    console.log(`✅ ${updateCount} tower di-update dengan data jarak`);
    
    // Save kembali ke backend
    if (updateCount > 0) {
      const confirm = window.confirm(
        `Update ${updateCount} tower dengan data jarak dari TDS ULTG?\n\n` +
        `Data akan disimpan ke Google Sheets.`
      );
      
      if (confirm) {
        await apiSave('tower_master', updatedTowers);
        alert(`✅ ${updateCount} tower berhasil diupdate!`);
        
        // Refresh halaman
        location.reload();
      }
    } else {
      alert('Tidak ada tower yang match dengan data jarak.');
    }
    
  } catch (error) {
    console.error('Error update jarak:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Load data jarak dari JSON file
 */
async function loadJarakData() {
  // Untuk sementara, return data hardcoded
  // Nanti bisa di-replace dengan fetch dari file JSON atau backend
  
  return {
    "BONDOWOSO-SITUBONDO": {
      "penghantar": "BONDOWOSO-SITUBONDO",
      "prefix": "BONDOWOSO",
      "total_towers": 109,
      "total_panjang_km": 34.8,
      "towers": [] // Data lengkap akan di-inject
    },
    "PAITON-SITUBONDO": {
      "penghantar": "PAITON-SITUBONDO", 
      "prefix": "PAITON",
      "total_towers": 157,
      "total_panjang_km": 53.72,
      "towers": []
    },
    "SITUBONDO-BANYUWANGI": {
      "penghantar": "SITUBONDO-BANYUWANGI",
      "prefix": "BWI",
      "total_towers": 281,
      "total_panjang_km": 87.18,
      "towers": []
    }
  };
}

// Export untuk digunakan di HTML
if (typeof window !== 'undefined') {
  window.updateJarakTower = updateJarakTower;
  window.JARAK_TOWER_DATA = JARAK_TOWER_DATA;
}
