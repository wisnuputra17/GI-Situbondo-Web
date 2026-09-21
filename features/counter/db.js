/**
 * features/counter/db.js
 * Logika data modul Counter Peralatan — GI Situbondo.
 *
 * Struktur: 10 BAY, tiap bay punya beberapa SLOT counter (PMT/LA/OLTC,
 * sebagian per fasa R/S/T). Counter dicatat sebagai pembacaan berurutan
 * (bukan nilai tunggal yang ditimpa) supaya selisih & laju pemakaian bisa
 * dihitung. Pencatatan dilakukan sewaktu-waktu (tidak terjadwal tetap).
 *
 * Tidak ada konsep "ambang batas" — counter berapapun nilainya dianggap
 * aman. Yang dipantau di sini murni nilai terkini, tren, dan kualitas input
 * (pembacaan yang tampak mundur/salah ketik).
 *
 * Sheet: counter_log (timestamp, id_peralatan, jenis_counter, nilai, oleh).
 * Nama kolom sheet dipertahankan (skema lama, tanpa migrasi Code.gs):
 *   id_peralatan  → diisi ID BAY (mis. 'TRAFO-1', 'PTN-1')
 *   jenis_counter → diisi SLOT key (mis. 'PMT', 'LA-R', 'OLTC', 'PMT-S')
 */

/**
 * 10 bay di GI Situbondo. `jenis` menentukan slot counter apa saja yang
 * dipunyai bay tsb (lihat slotUntukBay).
 */
const BAY_LIST = [
  { id: 'TRAFO-1', label: 'Trafo 1', jenis: 'trafo' },
  { id: 'TRAFO-2', label: 'Trafo 2', jenis: 'trafo' },
  { id: 'TRAFO-3', label: 'Trafo 3', jenis: 'trafo' },
  { id: 'BWI-1', label: 'Banyuwangi #1', jenis: 'penghantar' },
  { id: 'BWI-2', label: 'Banyuwangi #2', jenis: 'penghantar' },
  { id: 'KOPEL', label: 'Kopel', jenis: 'kopel' },
  { id: 'BDW-1', label: 'Bondowoso #1', jenis: 'penghantar' },
  { id: 'BDW-2', label: 'Bondowoso #2', jenis: 'penghantar' },
  { id: 'PTN-1', label: 'Paiton #1', jenis: 'penghantar' },
  { id: 'PTN-2', label: 'Paiton #2', jenis: 'penghantar' }
];

/** Label untuk jenis bay, dipakai di sub-judul kartu & filter. */
const JENIS_BAY = {
  trafo: { label: 'Bay Trafo' },
  penghantar: { label: 'Bay Penghantar' },
  kopel: { label: 'Bay Kopel' }
};

function bayById(id) {
  return BAY_LIST.find((b) => b.id === id) || null;
}

/**
 * Slot counter per jenis bay. Semua satuannya 'kali' (jumlah kerja/operasi).
 *   - trafo:      PMT (1), LA Fasa R/S/T (3), OLTC (1)      = 5 slot
 *   - kopel:      PMT (1), LA Fasa R/S/T (3)                = 4 slot
 *   - penghantar: PMT Fasa R/S/T (3), LA Fasa R/S/T (3)     = 6 slot
 */
function slotUntukBay(jenisBay) {
  const la = ['R', 'S', 'T'].map((f) => ({ key: `LA-${f}`, kelompok: 'LA', fasa: f }));
  if (jenisBay === 'trafo') {
    return [{ key: 'PMT', kelompok: 'PMT', fasa: null }, ...la, { key: 'OLTC', kelompok: 'OLTC', fasa: null }];
  }
  if (jenisBay === 'kopel') {
    return [{ key: 'PMT', kelompok: 'PMT', fasa: null }, ...la];
  }
  // penghantar
  const pmt = ['R', 'S', 'T'].map((f) => ({ key: `PMT-${f}`, kelompok: 'PMT', fasa: f }));
  return [...pmt, ...la];
}

function labelSlot(slot) {
  return slot.fasa ? `${slot.kelompok} · Fasa ${slot.fasa}` : slot.kelompok;
}

/** Semua slot milik satu bay (dari id bay), atau [] kalau bay tak dikenal. */
function slotBay(idBay) {
  const bay = bayById(idBay);
  return bay ? slotUntukBay(bay.jenis) : [];
}

// ---------- Baca / tulis ----------

/**
 * Timestamp pembacaan.
 *
 * `new Date('2026-09-16').toISOString()` menghasilkan tengah malam UTC, jadi
 * DUA pembacaan pada tanggal yang sama menghasilkan timestamp IDENTIK. Akibatnya:
 * urutan sort jadi sembarang (bisa memunculkan `mundur` palsu) dan
 * `hapusPembacaan` menghapus KEDUA baris sekaligus. Karena itu tanggal
 * pilihan user digabung dengan jam lokal saat input supaya tetap unik dan
 * tetap jatuh pada hari yang benar menurut waktu setempat (WIB).
 */
function stempelWaktu(tanggal) {
  const now = new Date();
  if (!tanggal) return now.toISOString();

  const m = String(tanggal).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const d = new Date(tanggal);
    return isNaN(d.getTime()) ? now.toISOString() : d.toISOString();
  }
  const lokal = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()
  );
  return lokal.toISOString();
}

async function loadCounterLog() {
  const rows = await apiLoad('counter_log');
  return rows
    .filter((r) => r && r.id_peralatan && r.jenis_counter)
    // Sel nilai yang kosong/bukan angka DIBUANG, bukan dijadikan 0.
    // `Number('') || 0` dulu memunculkan pembacaan 0 palsu yang memicu
    // peringatan "counter mundur" dan merusak perhitungan laju.
    .filter((r) => Number.isFinite(Number(r.nilai)) && String(r.nilai).trim() !== '')
    .map((r) => ({
      timestamp: r.timestamp || '',
      id_bay: String(r.id_peralatan),
      slot: String(r.jenis_counter),
      nilai: Number(r.nilai),
      oleh: r.oleh || ''
    }))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

async function addPembacaan({ id_bay, slot, nilai, tanggal, oleh }) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) throw new Error('Nilai counter harus berupa angka');

  const row = {
    timestamp: stempelWaktu(tanggal),
    id_peralatan: id_bay,
    jenis_counter: slot,
    nilai: angka,
    oleh: oleh || 'Wisnu'
  };
  await apiAppend('counter_log', row);
  return row;
}

/**
 * Simpan beberapa slot bay sekaligus (mode "Isi Counter") — satu kunjungan
 * biasanya mengisi banyak slot dalam bay yang sama. Slot yang dikosongkan
 * user dilewati, bukan disimpan sebagai 0.
 */
async function addPembacaanBanyak(idBay, nilaiPerSlot, tanggal, oleh) {
  const hasil = [];
  for (const [slot, nilai] of Object.entries(nilaiPerSlot)) {
    if (nilai === '' || nilai === null || nilai === undefined) continue;
    hasil.push(await addPembacaan({ id_bay: idBay, slot, nilai, tanggal, oleh }));
  }
  return hasil;
}

/** Hapus satu pembacaan (mis. salah input). Dicocokkan dari timestamp + bay + slot. */
async function hapusPembacaan(timestamp, idBay, slot) {
  const semua = await loadCounterLog();
  const sisa = semua.filter((r) =>
    !(r.timestamp === timestamp && r.id_bay === idBay && r.slot === slot));
  await apiSave('counter_log', sisa.map((r) => ({
    timestamp: r.timestamp, id_peralatan: r.id_bay, jenis_counter: r.slot, nilai: r.nilai, oleh: r.oleh
  })));
  return semua.length - sisa.length;
}

// ---------- Pengolahan ----------

/**
 * Kelompokkan pembacaan per bay + slot, lalu hitung turunannya: nilai
 * terakhir, selisih dari pembacaan sebelumnya, dan laju per bulan.
 * Hasil berupa map "idBay|slot" -> ringkasan, supaya gampang dicocokkan ke
 * struktur BAY_LIST/slotBay saat render kartu.
 */
function rangkumCounter(logs) {
  const seri = {};
  logs.forEach((l) => {
    const k = l.id_bay + '|' + l.slot;
    if (!seri[k]) seri[k] = { id_bay: l.id_bay, slot: l.slot, data: [] };
    seri[k].data.push(l);
  });

  const out = {};
  Object.values(seri).forEach((s) => {
    const d = s.data.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    const akhir = d[d.length - 1];
    const sebelum = d.length > 1 ? d[d.length - 2] : null;

    let delta = null, lajuBulan = null, mundur = false;
    if (sebelum) {
      delta = akhir.nilai - sebelum.nilai;
      // Counter mekanis normalnya hanya naik. Turun = salah input atau alat diganti.
      mundur = delta < 0;
      const hari = (new Date(akhir.timestamp) - new Date(sebelum.timestamp)) / 86400000;
      if (hari > 0.5 && delta >= 0) lajuBulan = (delta / hari) * 30;
    }

    out[s.id_bay + '|' + s.slot] = {
      ...s, data: d,
      nilai: akhir.nilai,
      terakhir: akhir.timestamp,
      oleh: akhir.oleh,
      jumlahBaca: d.length,
      delta, lajuBulan, mundur
    };
  });
  return out;
}

/** Titik-titik untuk sparkline (dinormalkan ke kotak w x h). */
function titikSparkline(data, w, h) {
  if (data.length < 2) return '';
  const nilai = data.map((d) => d.nilai);
  const min = Math.min(...nilai), max = Math.max(...nilai);
  const rentang = max - min || 1;
  const t0 = new Date(data[0].timestamp).getTime();
  const t1 = new Date(data[data.length - 1].timestamp).getTime();
  const rentangT = t1 - t0 || 1;
  return data.map((d) => {
    const x = ((new Date(d.timestamp).getTime() - t0) / rentangT) * w;
    const y = h - ((d.nilai - min) / rentang) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
