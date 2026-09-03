# Katalog Error

## Ringkasan error

| URI type | Status | Kondisi pemicu | Extension members | Tindakan klien |
| --- | --- | --- | --- | --- |
| /equipments | 400 | Query parameter tidak valid atau kombinasi filter tidak diterima. | `detail` dan `instance` | Perbaiki parameter request dan ulangi. |
| /rentals | 400 | Body request tidak valid atau field yang wajib tidak lengkap. | `detail` dan `instance` | Koreksi payload dan kirim kembali. |
| /rentals | 409 | Header `Idempotency-Key` digunakan kembali dengan body berbeda atau jadwal bentrok. | `conflictingRentalId`, `unavailableDates` | Gunakan key yang sama untuk intent yang sama, atau pilih jadwal yang tersedia. |
| /rentals/{id} | 404 | Rental tidak ditemukan atau sudah tidak valid untuk operasi saat ini. | `instance` | Verifikasi identifier yang dipanggil. |
| /rentals/{id}/inspections | 422 | Data inspeksi gagal validasi aturan bisnis (misalnya status tidak dapat diproses). | `detail`, `instance` | Perbaiki data inspeksi dan kirim ulang. |
| /rentals/{id}/inspections | 409 | Inspeksi ganda atau konflik status operasional pada alat. | `conflictingRentalId`, `instance` | Tinjau status rental dan ulangi setelah konflik diselesaikan. |
| Semua endpoint | 401/403 | Kredensial tidak valid atau akses tidak diizinkan. | `detail`, `instance` | Perbarui autentikasi atau minta akses yang sesuai. |
| Semua endpoint | 500 | Kegagalan server yang tidak terduga. | `detail`, `instance` | Coba lagi dengan backoff dan laporkan `instance` bila berulang. |

## Format error

Semua response error dikembalikan dalam media type `application/problem+json` berdasarkan RFC 9457.

```json
{
  "type": "https://api.heavyrental.co/problems/validation-error",
  "title": "Validation error",
  "status": 422,
  "detail": "The request content does not satisfy the required contract rules.",
  "instance": "https://api.heavyrental.co/rentals",
  "conflictingRentalId": "rnt_3MnB7xP",
  "unavailableDates": ["2026-09-15", "2026-09-16"]
}
```

## Catatan

- Client wajib tidak crash saat menerima nilai status yang tidak dikenal.
- Extension member bersifat endpoint-specific; client harus mengabaikan extension yang tidak dikenali.
