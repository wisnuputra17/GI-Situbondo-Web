# Sample Data Counter Peralatan — PLN GI Suite

**Pastikan sheet ini sudah ada di Google Sheets sebelum catat pembacaan via UI.**

## Sheet: `peralatan_master`

| id_peralatan | jenis | bay | notes |
|---|---|---|---|
| PMT-UT-01 | PMT Saklar Utama | UT | Pemutus Tenaga Utama |
| PMT-JT-01 | PMT Penghantar | JT-1 | PMT Jalur Transmisi 1 (STBDO-PITON) |
| PMT-JT-02 | PMT Penghantar | JT-2 | PMT Jalur Transmisi 2 (STBDO-BWNGI) |
| CB-TRAFO-01 | Circuit Breaker | CB-A | CB Trafo 1 150/20 kV |
| DS-UT-01 | Disconnect Switch | UT | Disconnect Switch Utama |
| LA-01 | Lightning Arrester | LA-1 | Penangkal Petir Sisi 150 kV |
| KOMPRESOR-01 | Compressor | UDARA | Kompresor Udara Tekan |

## Sheet: `counter_log`

| timestamp | id_peralatan | jenis_counter | nilai | oleh |
|---|---|---|---|---|
| 2026-09-15T07:30:00Z | PMT-UT-01 | kerja_pmt | 1850 | Wisnu |
| 2026-09-15T07:30:00Z | PMT-JT-01 | kerja_pmt | 2150 | Wisnu |
| 2026-09-15T07:35:00Z | PMT-JT-02 | kerja_pmt | 1920 | Wisnu |
| 2026-09-15T08:00:00Z | CB-TRAFO-01 | kerja_pms | 850 | Wisnu |
| 2026-09-15T09:00:00Z | PMT-UT-01 | jam_operasi | 38500 | Wisnu |
| 2026-09-15T09:05:00Z | PMT-JT-01 | jam_operasi | 39200 | Wisnu |
| 2026-09-15T10:00:00Z | KOMPRESOR-01 | jam_kompresor | 4800 | Wisnu |
| 2026-09-16T07:30:00Z | PMT-UT-01 | kerja_pmt | 1858 | Wisnu |
| 2026-09-16T07:35:00Z | PMT-JT-01 | kerja_pmt | 2165 | Wisnu |
| 2026-09-16T07:40:00Z | PMT-JT-02 | kerja_pmt | 1930 | Wisnu |
| 2026-09-16T08:30:00Z | CB-TRAFO-01 | kerja_pms | 862 | Wisnu |
| 2026-09-16T09:00:00Z | PMT-UT-01 | jam_operasi | 38524 | Wisnu |
| 2026-09-16T09:05:00Z | PMT-JT-01 | jam_operasi | 39235 | Wisnu |
| 2026-09-16T10:00:00Z | KOMPRESOR-01 | jam_kompresor | 4848 | Wisnu |
| 2026-09-17T07:30:00Z | PMT-UT-01 | trip_gangguan | 18 | Wisnu |
| 2026-09-17T08:00:00Z | LA-01 | operasi_la | 8 | Wisnu |
| 2026-09-18T07:30:00Z | PMT-UT-01 | kerja_pmt | 1872 | Wisnu |
| 2026-09-18T07:35:00Z | PMT-JT-01 | kerja_pmt | 2188 | Wisnu |
| 2026-09-18T07:40:00Z | PMT-JT-02 | kerja_pmt | 1960 | Wisnu |
| 2026-09-18T08:30:00Z | CB-TRAFO-01 | kerja_pms | 878 | Wisnu |
| 2026-09-20T08:00:00Z | PMT-UT-01 | kerja_pmt | 1895 | Wisnu |
| 2026-09-20T08:05:00Z | PMT-JT-01 | kerja_pmt | 2220 | Wisnu |
| 2026-09-20T08:10:00Z | PMT-JT-02 | kerja_pmt | 1985 | Wisnu |
| 2026-09-20T09:00:00Z | PMT-UT-01 | jam_operasi | 38600 | Wisnu |
| 2026-09-20T09:05:00Z | PMT-JT-01 | jam_operasi | 39350 | Wisnu |

## Cara Import ke Google Sheets

1. **Buka Google Sheets** → GI Situbondo project sheet
2. **Buat sheet baru** dengan nama `peralatan_master` dan `counter_log`
3. **Copy-paste data di atas** ke masing-masing sheet
4. **Test UI** → Login → Counter Peralatan → Data akan muncul otomatis

## Ambang (Threshold) Default

Lihat di **`features/counter/db.js`** — `JENIS_COUNTER`:

- **Kerja PMT**: 2000 kali (ambang perhatian)
- **Trip gangguan**: 20 kali (jarang banget)
- **Jam operasi**: 40,000 jam (≈ 4.5 tahun)
- **Kerja PMS**: 1000 kali
- **Operasi LA (arrester)**: 10 kali
- **Jam kompresor**: 5000 jam
- **Start genset**: 500 kali
- **Lain-lain**: tanpa ambang (untuk custom counter)

---

**Progress Report Counter Peralatan:**
- ✅ UI modul selesai (tabel, filter, modal, form)
- ✅ Logic rangkuman & perhitungan selesai
- ✅ Integrasi API ke Apps Script selesai
- 🔄 **NEXT:** Input data peralatan & log pembacaan ke Google Sheets → Ujicoba catat pembacaan via UI
