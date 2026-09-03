# Kebijakan Kompatibilitas API

Tujuan singkat: menjelaskan tipe perubahan yang diperbolehkan tanpa memutus kompatibilitas klien, serta mekanisme deprecation dan penanganan field tidak dikenal.

1. Additive Change (Diperbolehkan)
- Menambahkan endpoint baru (`/v1/...`) atau menambahkan properti baru pada schema dianggap perubahan aditif dan aman.
- Klien lama harus mengabaikan field yang tidak dikenal.

2. Perubahan yang Memutus Kompatibilitas (Tidak Diizinkan tanpa koordinasi)
- Menghapus field yang sudah ada, mengubah tipe field yang ada (mis. integer → object), atau mengubah semantics respons yang menyebabkan klien gagal harus diumumkan dan dikoordinasikan.

3. Deprecation
- Gunakan header `Deprecation: true` dan `Sunset: <date>` untuk menandai endpoint/field yang dipensiunkan (deprecated).
- Berikan periode grace yang jelas (mis. minimal 90 hari) dan dokumentasikan migrasi yang disarankan (migration guide).

4. Penanganan Field Tidak Dikenal di Sisi Klien
- Klien harus mengabaikan field tambahan yang tidak dikenali (forward-compatible).
- Opsional: Klien dapat menjalankan validasi ketat di mode pengembangan tetapi harus dapat beroperasi saat menerima field ekstra dari server.

5. Versi Kontrak
- Versi kompatibilitas ditunjukkan di dokumentasi; perubahan breaking harus menaikkan major version pada dokumentasi/spec.
