# Katalog Error (B.4)

Semua respons error memakai RFC 9457 dengan media type `application/problem+json`. Nilai `type` di bawah adalah URI stabil yang dapat dipakai klien untuk menentukan tindakan; contoh payload konkretnya dideklarasikan pada response terkait di `openapi.yaml`.

| URI type | Status | Kondisi pemicu | Extension members | Tindakan klien |
| --- | --- | --- | --- | --- |
| `https://api.heavyrental.co/problems/invalid-request` | 400 | Parameter filter tidak valid atau body request tidak dapat diproses. | Tidak ada; gunakan `detail`, `instance`. | Jangan retry; perbaiki request. |
| `https://api.heavyrental.co/problems/request-validation-failed` | 422 | Request tidak memenuhi kontrak, misalnya `Idempotency-Key` wajib tidak dikirim. | Tidak ada; gunakan `detail`, `instance`. | Jangan retry; lengkapi atau koreksi request. |
| `https://api.heavyrental.co/problems/resource-not-found` | 404 | Rental pada path tidak ditemukan. | Tidak ada; gunakan `detail`, `instance`. | Jangan retry; verifikasi ID atau perbarui tampilan. |
| `https://api.heavyrental.co/problems/rental-schedule-conflict` | 409 | Jadwal rental bertabrakan dengan rental aktif untuk equipment yang sama. | `conflictingRentalId`, `unavailableDates`. | Jangan retry otomatis; minta pengguna memilih jadwal lain. |
| `https://api.heavyrental.co/problems/idempotency-key-reuse` | 409 | `Idempotency-Key` dipakai kembali dengan body yang berbeda. | Tidak ada. | Jangan retry dengan key tersebut; buat intent baru setelah pengguna mengonfirmasi. |
| `https://api.heavyrental.co/problems/idempotency-request-in-progress` | 409 | Request awal dengan key yang sama masih diproses. | Header `Retry-After`. | Retry setelah interval pada header dengan key dan body yang sama. |
| `https://api.heavyrental.co/problems/inspection-conflict` | 409 | Inspeksi ganda atau status operasional equipment sedang berkonflik. | `conflictingRentalId`. | Jangan retry otomatis; muat ulang status rental. |
| `https://api.heavyrental.co/problems/inspection-rule-violation` | 422 | Body inspeksi valid secara sintaksis tetapi melanggar aturan bisnis. | Tidak ada; gunakan `detail`, `instance`. | Jangan retry; tampilkan alasan dan minta koreksi pengguna. |
| `https://api.heavyrental.co/problems/rental-rule-violation` | 422 | Body rental valid secara sintaksis tetapi tidak dapat diproses oleh aturan bisnis. | Tidak ada; gunakan `detail`, `instance`. | Jangan retry; tampilkan alasan dan minta koreksi pengguna. |

Klien wajib mengabaikan extension member yang tidak dikenali dan tidak boleh crash saat menerima nilai status resource yang baru.
