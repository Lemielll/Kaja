# Pernyataan Idempotency (Operasi Unsafe)

Operasi mutasi rental dan inspeksi bersifat **unsafe** dan konsekuensial. Oleh karena itu, operasi ini wajib dilindungi dengan `Idempotency-Key`.

## Ketentuan Penerapan Idempotency Key

1. **Nama Header & Format Value:**
   - Mandatory Header: `Idempotency-Key`.
   - Format: UUID Version 4 dalam bentuk kanonik dengan tanda hubung (contoh: `0f7c1b9e-3d21-4a6f-9c05-8e2b7d41a9f0`).
2. **Cakupan Operasi Wajib:**
   - Wajib pada: `POST /rentals` dan `POST /rentals/{id}/inspections`.
   - Diabaikan pada: Seluruh operasi `GET` dan operasi safe/idempotent lainnya.
3. **Jendela Retensi (Retention Window):**
   - Key dan respons yang bersangkutan disimpan oleh server selama **24 jam**. Key yang dikirim ulang setelah 24 jam diperlakukan sebagai key baru.
4. **Perilaku Penggunaan Ulang Key (Re-use Behavior):**
   - **Body Identik:** Server mengembalikan respons tersimpan tanpa memproses ulang transaksi.
   - **Body Berbeda:** Server menolak request dengan status `409 Conflict` dan mengembalikan Problem Details RFC 9457 dengan type idempotency-key-reuse.
   - **Request Asal Masih Diproses:** Server mengembalikan status `409 Conflict` disertai header `Retry-After`.
