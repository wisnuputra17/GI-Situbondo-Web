/**
 * features/counter/db.js
 * Logika data modul Counter Peralatan.
 *
 * Counter dicatat sebagai pembacaan berurutan (bukan nilai tunggal yang
 * ditimpa), supaya selisih antar pembacaan dan laju pemakaian bisa dihitung.
 * Sheet: counter_log (timestamp, id_peralatan, jenis_counter, nilai, oleh).
 */

/**
 * Jenis counter yang lazim dipantau di gardu induk.
 * `ambang` = perkiraan awal batas perhatian — WAJIB disesuaikan dengan
 * ketentuan pemeliharaan yang berlaku di unit, bukan angka baku.
 */
const JENIS_COUNTER = [
  { key: 'kerja_pmt',    label: 'Jumlah kerja PMT',      satuan: 'kali',  ambang: 2000 },
  { key: 'trip_gangguan',label: 'Trip karena gangguan',  satuan: 'kali',  ambang: 20 },
  { key: 'jam_operasi',  label: 'Jam operasi',           satuan: 'jam',   ambang: 40000 },
  { key: 'kerja_pms',    label: 'Jumlah kerja PMS',      satuan: 'kali',  ambang: 1000 },
  { key: 'operasi_la',   label: 'Kerja LA (arrester)',   satuan: 'kali',  ambang: 10 },
  { key: 'jam_kompresor',label: 'Jam kerja kompresor',   satuan: 'jam',   ambang: 5000 },
  { key: 'start_genset', label: 'Start genset',          satuan: 'kali',  ambang: 500 },
  { key: 'lain',         label: 'Lain-lain',             satuan: '',      ambang: null }
];

function jenisCounter(key) {
  return JENIS_COUNTER.find((j) => j.key === key) || JENIS_COUNTER[JENIS_COUNTER.length - 1];
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
      id_peralatan: String(r.id_peralatan),
      jenis_counter: String(r.jenis_counter),
      nilai: Number(r.nilai),
      oleh: r.oleh || ''
    }))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

async function addPembacaan({ id_peralatan, jenis_counter, nilai, tanggal, oleh }) {
  const angka = Number(nilai);
  if (!Number.isFinite(angka)) throw new Error('Nilai counter harus berupa angka');

  const row = {
    timestamp: stempelWaktu(tanggal),
    id_peralatan,
    jenis_counter,
    nilai: angka,
    oleh: oleh || 'Wisnu'
  };
  await apiAppend('counter_log', row);
  return row;
}

/** Hapus satu pembacaan (mis. salah input). Dicocokkan dari timestamp + id. */
async function hapusPembacaan(timestamp, id_peralatan, jenis_counter) {
  const semua = await loadCounterLog();
  const sisa = semua.filter((r) =>
    !(r.timestamp === timestamp && r.id_peralatan === id_peralatan && r.jenis_counter === jenis_counter));
  await apiSave('counter_log', sisa);
  return semua.length - sisa.length;
}

// ---------- Pengolahan ----------

/**
 * Kelompokkan pembacaan per peralatan + jenis counter, lalu hitung turunannya:
 * nilai terakhir, selisih dari pembacaan sebelumnya, dan laju per bulan.
 */
function rangkumCounter(logs) {
  const seri = {};
  logs.forEach((l) => {
    const k = l.id_peralatan + '|' + l.jenis_counter;
    if (!seri[k]) seri[k] = { id_peralatan: l.id_peralatan, jenis_counter: l.jenis_counter, data: [] };
    seri[k].data.push(l);
  });

  return Object.values(seri).map((s) => {
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

    const j = jenisCounter(s.jenis_counter);
    const pctAmbang = j.ambang ? (akhir.nilai / j.ambang) * 100 : null;

    return {
      ...s, data: d,
      nilai: akhir.nilai,
      terakhir: akhir.timestamp,
      oleh: akhir.oleh,
      jumlahBaca: d.length,
      delta, lajuBulan, mundur,
      ambang: j.ambang,
      pctAmbang,
      statusAmbang: pctAmbang === null ? null : (pctAmbang >= 100 ? 'lewat' : pctAmbang >= 80 ? 'dekat' : 'aman')
    };
  }).sort((a, b) =>
    a.id_peralatan.localeCompare(b.id_peralatan) || a.jenis_counter.localeCompare(b.jenis_counter));
}

/** Perkiraan bulan tersisa sampai menyentuh ambang, berdasarkan laju terakhir. */
function perkiraanBulan(r) {
  if (!r.ambang || !r.lajuBulan || r.lajuBulan <= 0) return null;
  const sisa = r.ambang - r.nilai;
  if (sisa <= 0) return 0;
  return sisa / r.lajuBulan;
}

/** Ringkasan untuk kartu metrik. */
function ringkasCounter(rangkuman) {
  return {
    totalSeri: rangkuman.length,
    peralatan: new Set(rangkuman.map((r) => r.id_peralatan)).size,
    lewatAmbang: rangkuman.filter((r) => r.statusAmbang === 'lewat').length,
    dekatAmbang: rangkuman.filter((r) => r.statusAmbang === 'dekat').length,
    anomaliInput: rangkuman.filter((r) => r.mundur).length
  };
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
