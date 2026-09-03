# 0001. Penetapan Domain Sistem Sewa dan Pengeluaran Alat Berat Proyek

## Context

Proses bisnis penyewaan dan distribusi alat berat pada proyek konstruksi sering mengalami kendala koordinasi antara kontraktor, admin gudang, dan operator lapangan. Untuk memvalidasi seluruh alur kerja sistem, domain harus mencakup batas operasional berikut:

> Kontraktor proyek mengajukan permohonan peminjaman alat berat dan melakukan pembayaran jaminan sewa secara digital. Admin gudang menyetujui jadwal pengeluaran alat. Operator lapangan yang bekerja di lokasi konstruksi terpencil dengan koneksi internet intermiten menerima unit tersebut, melakukan inspeksi fisik, dan melaporkan status penyelesaian proyek secara berkala melalui perangkat mobile.

### Pemeriksaan Syarat Wajib Domain:

1. **Minimal 3 Jenis Aktor dengan Hak Akses Berbeda:**
   - **Kontraktor Proyek:** Mengajukan sewa dan melakukan pembayaran jaminan.
   - **Admin Gudang:** Memverifikasi pembayaran dan menyetujui jadwal pengeluaran alat.
   - **Operator Lapangan:** Melakukan inspeksi penerimaan fisik dan melaporkan status pengerjaan.
2. **Minimal 1 Operasi Unsafe dan Konsekuensial:**
   - Pembayaran jaminan sewa secara digital (`POST /v1/lease-payments`). Operasi ini bersifat _unsafe_ dan tidak boleh terjadi diproses dua kali agar tidak menimbulkan pembebanan biaya ganda pada kontraktor.
3. **Minimal 1 Aktor di Luar Jangkauan Konektivitas Andal:**
   - Operator lapangan bekerja di lokasi proyek terpencil dengan koneksi internet yang intermiten/putus-nyambung, sehingga membutuhkan antrean mutasi lokal (_durable mutation queue_) pada aplikasi _mobile_.
4. **Cakupan Kecil dan Utuh:**
   - Memodelkan satu alur kerja spesifik dari awal (pengajuan sewa & pembayaran jaminan), persetujuan pengeluaran alat, hingga pelaporan penerimaan & status proyek akhir di lapangan. Paragraf deskripsi dapat dibaca dalam waktu kurang dari 30 detik.

---

## Decision

Kami memutuskan untuk menetapkan domain **Sistem Penyewaan dan Manajemen Pengeluaran Alat Berat Proyek** sebagai domain utama proyek ini selama satu semester.

Sistem akan dirancang dengan pendekatan _Contract-First_ (OpenAPI 3.1.0) dengan batas arsitektur sebagai berikut:

- **Service (Backend):** Bertindak sebagai penegak otoritatif tunggal atas aturan bisnis (misalnya: alat berat tidak boleh dijadwalkan keluar jika status jaminan sewa belum terverifikasi lulus/terbayar).
- **Kontrak (API):** Menyatakan status transisi yang valid, merinci skema idempotency key untuk operasi pembayaran, serta menyajikan format galat standar RFC 9457 Problem Details.
- **Klien (Web & Mobile):** Aplikasi Web digunakan oleh Admin Gudang, sedangkan Aplikasi Mobile digunakan oleh Kontraktor dan Operator Lapangan dengan dukungan penyimpanan transaksi lokal (_offline capability_).

---

## Alternatives Considered

1. **Sistem Manajemen Inventaris Alat Berat Internal (Tanpa Kontraktor Eksternal):**
   - _Alasan ditolak:_ Hanya melibatkan 2 aktor (Admin & Operator) dan seluruh transaksi berada di jaringan internal fixed-line. Tidak memenuhi syarat minimal 3 aktor dan syarat konektivitas intermiten.
2. **Sistem Pengadaan dan Pembelian Alat Berat:**
   - _Alasan ditolak:_ Cakupan alur kerja terlalu luas (memuat negosiasi vendor, pendaftaran lisensi, garansi, hingga depresiasi aset). Tidak memungkinkan diselesaikan secara utuh sampai Pertemuan 14.
3. **Sistem Pemesanan Alat Berat Sederhana (Tanpa Pembayaran Digital & Inspeksi Fisik):**
   - _Alasan ditolak:_ Mengabaikan aspek operasi _unsafe_ yang konsekuensial dan tidak memiliki alur kerja penerimaan di kondisi jaringan sulit.

---

## Consequences

### Dampak Positif (Positive Consequences):

- Memenuhi seluruh syarat formal materi perkuliahan dari Pertemuan 2 hingga Pertemuan 14 (Manajemen Identitas, Mode Offline, Real-time status, hingga Pengujian Kontrak).
- Memberikan pemisahan tanggung jawab (_separation of concerns_) yang jelas antar pemilik peran (Contract Owner, Service Owner, Client Owner, Integration Owner).
- Memastikan pencegahan _double-spending_ atau _duplicate request_ pada pembayaran jaminan sewa melalui penerapan `Idempotency-Key` di lapisan API & Service.

### Dampak Negatif & Mitigasi (Negative Consequences & Risks):

- **Kompleksitas Sinkronisasi Offline:** Operator lapangan memerlukan mekanisme antrean mutasi (_durable mutation queue_) pada aplikasi _mobile_ agar laporan inspeksi tidak hilang saat internet terputus.
- **Ketergantungan Spesifikasi Ketat:** Implementasi _backend_ (_service_) tidak dapat dimulai sebelum file `openapi.yaml` rampung dan tervalidasi oleh _mock server_ pada Pertemuan 2.
