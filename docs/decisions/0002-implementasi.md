# 0002. Pilihan Implementasi Layanan, Persistensi, dan Idempotensi

- **Status**: Accepted
- **Tanggal**: 2026-09-10
- **Penulis**: Hafidz Kurniawan Nahruntoko (Service Owner)

## Context

Layanan backend *Heavy Equipment Rental System* memerlukan deployment ke lingkungan cloud publik yang dapat diakses oleh pihak eksternal, persistensi data relasional yang tahan terhadap *restart* proses (*zero data loss*), serta mekanisme *server-side idempotency* untuk operasi penulisan (*unsafe write operations*) sesuai ketentuan Session 3 (A.7, A.8, A.10, A.11).

## Decision

1. **Hosting Provider**: Memilih **Render** (atau Railway) sebagai platform penyedia Web Service publik untuk folder `service/`, dipasangkan dengan basis data relasional **PostgreSQL** terkelola (Render PostgreSQL / Neon.tech).
2. **Mekanisme Penyimpanan Idempotency-Key**:
   - Disimpan secara persisten pada tabel basis data `idempotency_keys` di PostgreSQL (bukan *in-memory*).
   - Setiap *record* menyimpan nilai `key` (UUID), `request_hash` (string SHA-256 heksadesimal dari payload *request body*), `response_status` (HTTP status code), dan `response_body` (JSONB).
   - Aturan evaluasi: tolak *request* tanpa/salah header (400), catat dan proses jika *key* baru (201), kirim ulang hasil tersimpan tanpa duplikasi data jika *key* dan *hash* identik (201 replay), dan tolak jika *key* sama namun payload berbeda (409 idempotency-key-reuse).
3. **Kepatuhan Struktur Direktori**:
   - **Tidak ada deviasi dari struktur direktori yang ditentukan pada Bagian A.1**. Seluruh implementasi mengikuti hierarki resmi:
     - `service/db/`: Berisi `schema.sql` dan `seed.sql`.
     - `service/src/store/`: Satu-satunya layer yang menulis query SQL.
     - `service/src/schemas/`: Layer validasi input turunan kontrak OpenAPI.
     - `service/src/representations/`: Layer pembentuk respons JSON ke klien.
     - `service/src/routes/`: Orkestrasi router dan 5 bagian operasi.
     - `service/src/problem.js`: Generator format error RFC 9457 `application/problem+json`.

## Alternatives Considered

1. **In-Memory Idempotency Storage (Map/Set di RAM proses)**:
   - *Ditolak*, karena seluruh histori kunci idempotensi akan musnah saat proses server di-restart atau mengalami *crash*, memicu risiko *double-charge* atau data ganda saat *client retry*.
2. **Localhost / Ngrok Tunneling**:
   - *Ditolak*, karena tidak memenuhi kriteria kelulusan stabilitas layanan publik dan tidak dapat diakses secara persisten oleh asisten/rekan tim.
3. **Menggabungkan Query SQL langsung di Handler Route**:
   - *Ditolak*, karena melanggar prinsip separasi tanggung jawab A.1 dan memicu *internal column leaks*.

## Consequences

- Variabel lingkungan rahasia (`DATABASE_URL`) harus dikonfigurasi pada dashboard hosting dan dilarang keras di-commit ke Git.
- Performa penulisan POST sedikit terbebani oleh operasi lookup hash pada tabel idempotensi, namun menjamin konsistensi ACID dan kebal duplikasi.
- Menjamin portabilitas: database dapat dibangun dari keadaan kosong pada komputer baru hanya dengan mengeksekusi `schema.sql`.
