/**
 * test/run.js — penguji ringan tanpa dependensi.
 *
 * Fungsi murni di tiap db.js diuji dengan memuat berkasnya sebagai teks,
 * membuang fungsi async (yang butuh jaringan), lalu mengevaluasi sisanya.
 * Pendekatan ini dipakai karena proyek sengaja tanpa build step / npm.
 *
 * Jalankan: node test/run.js
 */
const fs = require('fs');
const path = require('path');

let lulus = 0, gagal = 0;
const gagalDetail = [];

function uji(nama, fn) {
  try { fn(); lulus++; }
  catch (e) { gagal++; gagalDetail.push({ nama, pesan: e.message }); }
}

function sama(a, b, ket) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${ket || ''} — dapat ${sa}, harusnya ${sb}`);
}
function benar(v, ket) { if (!v) throw new Error(ket || 'harusnya benar'); }
function dekat(a, b, toleransi, ket) {
  if (Math.abs(a - b) > (toleransi || 0.001)) throw new Error(`${ket || ''} — dapat ${a}, harusnya ≈${b}`);
}

/**
 * Muat fungsi murni dari sebuah db.js ke dalam konteks terisolasi.
 * Fungsi async dibuang karena butuh jaringan; sisanya dibiarkan sebagai
 * deklarasi biasa agar tetap saling terlihat, lalu diekspor lewat `ctx`
 * di akhir — bukan diubah jadi properti sejak awal, karena itu memutus
 * rujukan antar fungsi di dalam modul.
 */
function muatModul(relPath) {
  const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8')
    .replace(/^async function[\s\S]*?^}/gm, '');

  const nama = [
    ...src.matchAll(/^function (\w+)/gm),
    ...src.matchAll(/^const (\w+)\s*=/gm)
  ].map((m) => m[1]);

  const ekspor = nama.map((n) => `try { ctx.${n} = ${n}; } catch (e) {}`).join('\n');
  const ctx = {};
  new Function('ctx', src + '\n' + ekspor)(ctx);
  return ctx;
}

console.log('\n=== PLN GI Suite — uji fungsi murni ===\n');

// ---------------------------------------------------------------- counter
{
  const m = muatModul('features/counter/db.js');

  uji('BAY_LIST: 10 bay terdaftar', () => sama(m.BAY_LIST.length, 10));
  uji('bayById: ditemukan', () => sama(m.bayById('KOPEL').jenis, 'kopel'));
  uji('bayById: tak dikenal -> null', () => sama(m.bayById('NGAWUR'), null));

  uji('slotUntukBay: trafo 5 slot (PMT, LA-R/S/T, OLTC)', () => {
    sama(m.slotUntukBay('trafo').map((s) => s.key), ['PMT', 'LA-R', 'LA-S', 'LA-T', 'OLTC']);
  });
  uji('slotUntukBay: kopel 4 slot (PMT, LA-R/S/T)', () => {
    sama(m.slotUntukBay('kopel').map((s) => s.key), ['PMT', 'LA-R', 'LA-S', 'LA-T']);
  });
  uji('slotUntukBay: penghantar 6 slot (PMT R/S/T, LA R/S/T)', () => {
    sama(m.slotUntukBay('penghantar').map((s) => s.key), ['PMT-R', 'PMT-S', 'PMT-T', 'LA-R', 'LA-S', 'LA-T']);
  });
  uji('labelSlot: slot berfasa', () => sama(m.labelSlot({ kelompok: 'LA', fasa: 'R' }), 'LA · Fasa R'));
  uji('labelSlot: slot tanpa fasa', () => sama(m.labelSlot({ kelompok: 'OLTC', fasa: null }), 'OLTC'));

  const logs = [
    { timestamp: '2026-01-01T00:00:00Z', id_bay: 'TRAFO-1', slot: 'OLTC', nilai: 1500, oleh: 'A' },
    { timestamp: '2026-04-01T00:00:00Z', id_bay: 'TRAFO-1', slot: 'OLTC', nilai: 1700, oleh: 'A' },
    { timestamp: '2026-07-01T00:00:00Z', id_bay: 'TRAFO-1', slot: 'OLTC', nilai: 1950, oleh: 'A' },
    { timestamp: '2026-01-01T00:00:00Z', id_bay: 'PTN-1', slot: 'PMT-R', nilai: 2100, oleh: 'B' },
    { timestamp: '2026-06-01T00:00:00Z', id_bay: 'PTN-1', slot: 'PMT-R', nilai: 2050, oleh: 'B' }
  ];
  const rMap = m.rangkumCounter(logs);
  const r0 = rMap['TRAFO-1|OLTC'];
  const r1 = rMap['PTN-1|PMT-R'];

  uji('rangkumCounter: satu seri per bay+slot', () => sama(Object.keys(rMap).length, 2));
  uji('rangkumCounter: nilai terakhir diambil dari pembacaan terbaru', () => sama(r0.nilai, 1950));
  uji('rangkumCounter: delta dihitung dari pembacaan sebelumnya', () => sama(r0.delta, 250));
  uji('rangkumCounter: laju per bulan wajar', () => dekat(r0.lajuBulan, 82.4, 1));
  uji('rangkumCounter: counter turun ditandai mundur', () => benar(r1.mundur));
  uji('rangkumCounter: counter mundur tidak menghitung laju', () => sama(r1.lajuBulan, null));

  uji('titikSparkline: kosong bila data < 2', () => sama(m.titikSparkline([logs[0]], 80, 20), ''));
  uji('titikSparkline: titik pertama & terakhir menyentuh tepi', () => {
    const p = m.titikSparkline(logs.slice(0, 3), 100, 30).split(' ');
    sama(p.length, 3);
    benar(p[0].startsWith('0.0,'), 'titik pertama di x=0');
    benar(p[2].startsWith('100.0,'), 'titik terakhir di x=100');
  });
  uji('titikSparkline: nilai datar tidak membagi nol', () => {
    const datar = [
      { timestamp: '2026-01-01T00:00:00Z', nilai: 5 },
      { timestamp: '2026-02-01T00:00:00Z', nilai: 5 }
    ];
    const p = m.titikSparkline(datar, 50, 10);
    benar(!p.includes('NaN'), 'tidak boleh NaN');
  });

  // --- regresi: stempelWaktu (dulu selalu tengah malam UTC) ---
  uji('stempelWaktu: dua pembacaan sehari TIDAK bertabrakan', () => {
    const a = m.stempelWaktu('2026-09-16');
    benar(!a.endsWith('T00:00:00.000Z'), 'tidak boleh dipaku ke tengah malam UTC');
  });
  uji('stempelWaktu: tanggal jatuh pada hari lokal yang benar', () => {
    const d = new Date(m.stempelWaktu('2026-09-16'));
    sama([d.getFullYear(), d.getMonth() + 1, d.getDate()], [2026, 9, 16]);
  });
  uji('stempelWaktu: tanpa argumen memakai waktu sekarang', () => {
    const selisih = Math.abs(Date.now() - new Date(m.stempelWaktu()).getTime());
    benar(selisih < 5000, 'harus dekat dengan sekarang');
  });
  uji('stempelWaktu: tanggal ngawur tidak menghasilkan Invalid Date', () => {
    benar(!isNaN(new Date(m.stempelWaktu('bukan-tanggal')).getTime()));
  });
}

// ---------------------------------------------------------------- anomali
{
  const m = muatModul('features/anomali/db.js');

  uji('normalTower: status open -> terbuka', () => {
    sama(m.normalTower({ timestamp: 't', id_tower: 'T-1', jenis_anomali: 'X', status: 'open' }).status, 'terbuka');
  });
  uji('normalTower: status resolved -> selesai', () => {
    sama(m.normalTower({ timestamp: 't', id_tower: 'T-1', status: 'resolved' }).status, 'selesai');
  });
  uji('normalPeralatan: kondisi rusak = tingkat parah', () => {
    sama(m.normalPeralatan({ timestamp: 't', id_peralatan: 'P', kondisi: 'rusak' }).tingkat, 'parah');
  });
  uji('normalPeralatan: kondisi normal dianggap penutup', () => {
    sama(m.normalPeralatan({ timestamp: 't', id_peralatan: 'P', kondisi: 'normal' }).status, 'selesai');
  });
  uji('normalJaring: kondisi kosong dianggap selesai', () => {
    sama(m.normalJaring({ timestamp: 't', id_jaring: 'J', kondisi: 'kosong' }).status, 'selesai');
  });
  uji('normalJaring: judul jatuh ke kondisi bila jenis kosong', () => {
    sama(m.normalJaring({ timestamp: 't', id_jaring: 'J', kondisi: 'parah' }).judul, 'Kerusakan parah');
  });

  uji('umurHari: timestamp tidak valid -> null', () => sama(m.umurHari('bukan-tanggal'), null));
  uji('umurHari: hari ini -> 0', () => sama(m.umurHari(new Date().toISOString()), 0));

  const daftar = [
    { status: 'terbuka', tingkat: 'parah', sumber: 'tower', timestamp: new Date(Date.now() - 40 * 86400000).toISOString() },
    { status: 'terbuka', tingkat: 'perhatian', sumber: 'jaring', timestamp: new Date().toISOString() },
    { status: 'selesai', tingkat: 'perhatian', sumber: 'peralatan', timestamp: new Date().toISOString() }
  ];
  uji('ringkasAnomali: hitung terbuka, selesai, parah', () => {
    const s = m.ringkasAnomali(daftar);
    sama([s.total, s.terbuka, s.selesai, s.parah], [3, 2, 1, 1]);
  });
  uji('ringkasAnomali: temuan > 30 hari terhitung', () => {
    sama(m.ringkasAnomali(daftar).lebih30, 1);
  });
  uji('ringkasAnomali: daftar kosong tidak error', () => {
    const s = m.ringkasAnomali([]);
    sama([s.total, s.terbuka, s.tertua], [0, 0, null]);
  });

  uji('trenBulanan: panjang sesuai permintaan', () => sama(m.trenBulanan([], 6).length, 6));
  uji('trenBulanan: bulan ini terhitung', () => {
    const t = m.trenBulanan([{ timestamp: new Date().toISOString() }], 3);
    sama(t[t.length - 1].jumlah, 1);
  });
  uji('trenBulanan: timestamp rusak diabaikan', () => {
    const t = m.trenBulanan([{ timestamp: 'ngawur' }], 3);
    sama(t.reduce((a, b) => a + b.jumlah, 0), 0);
  });
}

// ---------------------------------------------------------- data-peralatan
{
  const m = muatModul('features/data-peralatan/db.js');

  uji('inisialJenis: pemetaan khusus dipakai', () => sama(m.inisialJenis('Transformator Daya'), 'TRF'));
  uji('inisialJenis: jenis tak dikenal diringkas', () => benar(m.inisialJenis('Panel Aneh Baru').length <= 3));
  uji('warnaBlok: stabil untuk kunci sama', () => {
    sama(m.warnaBlok('CT (Current Transformer)'), m.warnaBlok('CT (Current Transformer)'));
  });

  uji('usiaJaring: tahun kosong -> null', () => sama(m.usiaJaring(''), null));
  uji('usiaJaring: tahun di luar nalar -> null', () => sama(m.usiaJaring('1200'), null));
  uji('usiaJaring: hitung selisih tahun', () => {
    const th = new Date().getFullYear() - 5;
    sama(m.usiaJaring(String(th)), 5);
  });
  uji('statusUsia: >= 10 tahun perlu peremajaan', () => {
    sama(m.statusUsia(String(new Date().getFullYear() - 12)).key, 'tua');
  });
  uji('statusUsia: tanpa tahun -> tidak diketahui', () => {
    sama(m.statusUsia('').key, 'tidak-diketahui');
  });

  uji('denahRusak: data sehat -> null', () => {
    sama(m.denahRusak([
      { baris: 0, kolom: 0, ukuran: '14 x 14' },
      { baris: 0, kolom: 1, ukuran: '14 x 26' }
    ]), null);
  });
  uji('denahRusak: deteksi jaring menumpuk', () => {
    const r = m.denahRusak([
      { baris: 0, kolom: 0, ukuran: '14 x 14' },
      { baris: 0, kolom: 0, ukuran: '14 x 26' }
    ]);
    sama(r.tumpuk, 1);
  });
  uji('denahRusak: deteksi ukuran hilang', () => {
    sama(m.denahRusak([{ baris: 0, kolom: 0, ukuran: '' }]).tanpaUkuran, 1);
  });
  uji('denahRusak: daftar kosong -> null', () => sama(m.denahRusak([]), null));

  uji('parseTempelan: baca TSV', () => {
    const { hasil } = m.parseTempelan('TRF-01\tTransformator Daya\tBay 1\tUnindo\tTTUL\t123\t60 MVA\t1998\tnormal');
    sama(hasil.length, 1);
    sama([hasil[0].id_peralatan, hasil[0].jenis, hasil[0].kapasitas], ['TRF-01', 'Transformator Daya', '60 MVA']);
  });
  uji('parseTempelan: baca CSV', () => {
    const { hasil } = m.parseTempelan('PMT-01,PMT (Circuit Breaker),Bay 2,ABB,,,,,normal');
    sama(hasil[0].id_peralatan, 'PMT-01');
  });
  uji('parseTempelan: baris tanpa ID ditolak', () => {
    const { hasil, ditolak } = m.parseTempelan('\tTransformator Daya');
    sama([hasil.length, ditolak.length], [0, 1]);
  });
  uji('parseTempelan: baris header dilewati diam-diam', () => {
    const { hasil, ditolak } = m.parseTempelan('id_peralatan\tjenis\nTRF-01\tTransformator Daya');
    sama([hasil.length, ditolak.length], [1, 0]);
  });
  uji('parseTempelan: status tak dikenal jadi normal', () => {
    const { hasil } = m.parseTempelan('X-1,Busbar,,,,,,,ngawur');
    sama(hasil[0].status, 'normal');
  });

  // --- regresi: cocokkanJenis (dulu memotong 4 huruf + startsWith) ---
  uji('cocokkanJenis: kosong -> Lain-lain (bukan Transformator Daya)', () => {
    sama(m.cocokkanJenis(''), 'Lain-lain');
    sama(m.cocokkanJenis('   '), 'Lain-lain');
    sama(m.cocokkanJenis(undefined), 'Lain-lain');
  });
  uji('cocokkanJenis: "PMS Tanah" tidak nyasar ke PMS biasa', () => {
    sama(m.cocokkanJenis('PMS Tanah'), 'PMS Tanah (Earthing Switch)');
  });
  uji('cocokkanJenis: cocok persis dipakai apa adanya', () => {
    sama(m.cocokkanJenis('Busbar'), 'Busbar');
    sama(m.cocokkanJenis('pmt (circuit breaker)'), 'PMT (Circuit Breaker)');
  });
  uji('cocokkanJenis: singkatan dalam kurung dikenali', () => {
    sama(m.cocokkanJenis('Circuit Breaker'), 'PMT (Circuit Breaker)');
    sama(m.cocokkanJenis('Lightning Arrester'), 'LA (Lightning Arrester)');
  });
  uji('cocokkanJenis: teks asing -> Lain-lain', () => {
    sama(m.cocokkanJenis('ngawur bebas'), 'Lain-lain');
  });
  uji('parseTempelan: kolom jenis kosong TIDAK jadi Transformator Daya', () => {
    const { hasil } = m.parseTempelan('X-9,,Bay 3');
    sama(hasil[0].jenis, 'Lain-lain');
  });

  uji('ringkasPeralatan: hitung per jenis dan status', () => {
    const r = m.ringkasPeralatan([
      { jenis: 'Busbar', status: 'normal' },
      { jenis: 'Busbar', status: 'rusak' },
      { jenis: 'LA (Lightning Arrester)', status: 'normal' }
    ]);
    sama([r.total, r.perJenis['Busbar'], r.perStatus.normal, r.perStatus.rusak], [3, 2, 2, 1]);
  });

  uji('ringkasJaring: hitung kondisi & usia', () => {
    const th = String(new Date().getFullYear() - 12);
    const r = m.ringkasJaring([
      { kondisi: 'normal', tahun_pasang: th },
      { kondisi: 'parah', tahun_pasang: '' },
      { kondisi: 'normal', tahun_pasang: String(new Date().getFullYear() - 2) }
    ]);
    sama([r.total, r.perKondisi.normal, r.perKondisi.parah, r.perluRemaja, r.adaUsia], [3, 2, 1, 1, 2]);
  });

  uji('groupKondisi: kelompok per peralatan, terbaru di depan', () => {
    const g = m.groupKondisi([
      { id_peralatan: 'A', timestamp: '2026-01-01', kondisi: 'normal' },
      { id_peralatan: 'A', timestamp: '2026-05-01', kondisi: 'rusak' },
      { id_peralatan: 'B', timestamp: '2026-02-01', kondisi: 'normal' }
    ]);
    sama(g['A'].length, 2);
    sama(g['A'][0].timestamp, '2026-05-01');
  });
  uji('groupKondisi: baris tanpa id diabaikan', () => {
    sama(Object.keys(m.groupKondisi([{ timestamp: 'x' }, null])).length, 0);
  });

  uji('groupOpenAnomalies tidak ada di modul ini (milik shared)', () => {
    sama(typeof m.groupOpenAnomalies, 'undefined');
  });
}

// ---------------------------------------------------------------- gi-data
{
  const m = muatModul('shared/gi-data.js');

  uji('groupOpenAnomalies: hanya yang berstatus open', () => {
    const g = m.groupOpenAnomalies([
      { id_tower: 'T-1', status: 'open' },
      { id_tower: 'T-1', status: 'resolved' },
      { id_tower: 'T-2', status: 'open' }
    ]);
    sama([g['T-1'].length, g['T-2'].length], [1, 1]);
  });

  uji('summarizeByPenghantar: hitung total & anomali', () => {
    const s = m.summarizeByPenghantar([
      { penghantar: 'A', status: 'normal' },
      { penghantar: 'A', status: 'anomali' },
      { penghantar: 'B', status: 'normal' }
    ]);
    sama([s.A.total, s.A.anomali, s.B.total, s.B.anomali], [2, 1, 1, 0]);
  });

  // --- regresi: satu koordinat rusak dulu mematikan seluruh peta ---
  uji('koordinatSah: menolak NaN, kosong, 0,0, dan di luar rentang bumi', () => {
    benar(m.koordinatSah(-7.7, 114.0), 'koordinat wajar harus sah');
    benar(!m.koordinatSah(NaN, 114.0), 'NaN harus ditolak');
    benar(!m.koordinatSah(0, 0), '0,0 (Null Island) harus ditolak');
    benar(!m.koordinatSah(95, 114), 'lat > 90 harus ditolak');
    benar(!m.koordinatSah(-7.7, 200), 'lng > 180 harus ditolak');
    benar(!m.koordinatSah(Infinity, 0), 'Infinity harus ditolak');
  });
  uji('koordinatSah: sel spreadsheet kosong ditolak lewat nilai mentah', () => {
    // Number('') === 0, jadi tanpa cek mentah sel kosong lolos sebagai 0,0
    benar(!m.koordinatSah(Number(''), Number(''), '', ''), 'string kosong harus ditolak');
    benar(!m.koordinatSah(0, 0, null, null), 'null harus ditolak');
    benar(!m.koordinatSah(-7.7, 114, '  ', '114'), 'spasi saja harus ditolak');
    benar(m.koordinatSah(-7.7, 114, '-7.7', '114'), 'nilai mentah wajar tetap lolos');
  });
  uji('towerBerkoordinat: hanya yang valid yang boleh masuk peta', () => {
    const daftar = [
      { id_tower: 'T-1', koordinatValid: true },
      { id_tower: 'T-2', koordinatValid: false },
      { id_tower: 'T-3', koordinatValid: true }
    ];
    sama(m.towerBerkoordinat(daftar).map((t) => t.id_tower), ['T-1', 'T-3']);
    sama(m.towerTanpaKoordinat(daftar).map((t) => t.id_tower), ['T-2']);
  });
}

// ---------------------------------------------------------- seed & integritas
{
  const seedSrc = fs.readFileSync(path.join(__dirname, '..', 'features/data-peralatan/jaring-seed.js'), 'utf8');
  const ctx = {};
  new Function('ctx', seedSrc + '\nctx.JARING_SEED=JARING_SEED; ctx.DENAH_GARIS=DENAH_GARIS; ctx.DENAH_TIANG=DENAH_TIANG;')(ctx);

  uji('jaring-seed: 42 jaring', () => sama(ctx.JARING_SEED.length, 42));
  uji('jaring-seed: id unik', () => {
    sama(new Set(ctx.JARING_SEED.map((j) => j.id_jaring)).size, 42);
  });
  uji('jaring-seed: tidak ada posisi bertabrakan', () => {
    sama(new Set(ctx.JARING_SEED.map((j) => j.baris + ',' + j.kolom)).size, 42);
  });
  uji('jaring-seed: semua punya ukuran', () => {
    sama(ctx.JARING_SEED.filter((j) => !j.ukuran).length, 0);
  });
  uji('jaring-seed: posisi dalam batas grid 8x9', () => {
    benar(ctx.JARING_SEED.every((j) => j.baris >= 0 && j.baris < 8 && j.kolom >= 0 && j.kolom < 9));
  });
  uji('jaring-seed: rangka denah tersedia', () => {
    benar(ctx.DENAH_GARIS.length > 0 && ctx.DENAH_TIANG.length > 0);
  });

  const towerSrc = fs.readFileSync(path.join(__dirname, '..', 'features/peta-tower/tower-seed.js'), 'utf8');
  const tctx = {};
  new Function('ctx', towerSrc + '\nctx.TOWER_SEED=TOWER_SEED;')(tctx);

  uji('tower-seed: 417 menara', () => sama(tctx.TOWER_SEED.length, 417));
  uji('tower-seed: id unik', () => {
    sama(new Set(tctx.TOWER_SEED.map((t) => t.id_tower)).size, 417);
  });
  uji('tower-seed: koordinat di wilayah Jawa Timur', () => {
    benar(tctx.TOWER_SEED.every((t) =>
      t.lat > -9 && t.lat < -7 && t.lng > 112 && t.lng < 115), 'koordinat di luar nalar');
  });
  uji('tower-seed: tiga penghantar lengkap', () => {
    const c = {};
    tctx.TOWER_SEED.forEach((t) => { c[t.penghantar] = (c[t.penghantar] || 0) + 1; });
    sama(c, { 'STBDO-PITON': 157, 'STBDO-BWNGI': 151, 'BDWSO-STBDO': 109 });
  });
  uji('tower-seed: nomor berurutan tanpa celah per penghantar', () => {
    const per = {};
    tctx.TOWER_SEED.forEach((t) => { (per[t.penghantar] = per[t.penghantar] || []).push(t.nomor); });
    Object.keys(per).forEach((p) => {
      const n = per[p].sort((a, b) => a - b);
      for (let i = 0; i < n.length; i++) {
        if (n[i] !== i + 1) throw new Error(`${p} nomor ${i + 1} hilang`);
      }
    });
  });
}

// ------------------------------------------------- konsistensi skema backend
{
  const gs = fs.readFileSync(path.join(__dirname, '..', 'apps-script/Code.gs'), 'utf8');
  const blok = gs.slice(gs.indexOf('SHEET_HEADERS'), gs.indexOf('};', gs.indexOf('SHEET_HEADERS')));

  const wajib = {
    tower_master: ['id_tower', 'penghantar', 'nomor', 'lat', 'lng'],
    jaring_master: ['id_jaring', 'baris', 'kolom', 'ukuran'],
    jaring_kerusakan_log: ['id_jaring', 'kondisi'],
    peralatan_master: ['id_peralatan', 'jenis', 'bay'],
    counter_log: ['id_peralatan', 'jenis_counter', 'nilai'],
    kondisi_log: ['id_peralatan', 'kondisi'],
    tower_anomali_log: ['id_tower', 'jenis_anomali']
  };

  Object.keys(wajib).forEach((sheet) => {
    uji(`Code.gs: skema ${sheet} lengkap`, () => {
      const baris = blok.split('\n').find((b) => b.trim().startsWith(sheet + ':'));
      benar(baris, `sheet ${sheet} tidak ada di SHEET_HEADERS`);
      wajib[sheet].forEach((kol) => {
        benar(baris.includes(`'${kol}'`), `kolom ${kol} hilang dari ${sheet}`);
      });
    });
  });
}

// ------------------------------------------------------------------ laporan
console.log(`\n${'─'.repeat(52)}`);
if (gagal) {
  console.log(`GAGAL ${gagal} dari ${lulus + gagal} uji\n`);
  gagalDetail.forEach((g) => console.log(`  ✗ ${g.nama}\n    ${g.pesan}`));
  process.exit(1);
} else {
  console.log(`LULUS semua ${lulus} uji`);
  process.exit(0);
}
