# Pernyataan Idempotency

Tujuan: menjamin operasi "unsafe" (mutasi) dapat diulang tanpa menyebabkan efek samping ganda.

Ketentuan (empat poin wajib):

1. Nama header: `Idempotency-Key`
   - Header berbentuk string unik (disarankan UUID v4) yang dikirim klien pada setiap request mutasi.

2. Operasi wajib: header wajib dikirim pada semua operasi unsafe yang menghasilkan perubahan state, paling tidak untuk:
   - `POST /v1/lease-payments` (pembuatan pembayaran)
   - Operasi non-idempotent lain yang didesain kemudian

3. Jendela retensi: server wajib menyimpan mapping `Idempotency-Key` → response selama minimal `24 jam` sejak permintaan pertama.
   - Selama jendela ini, jika request dengan `Idempotency-Key` yang sama diterima ulang, server harus mengembalikan response awal (200/201/409 sesuai hasil awal) tanpa menghasilkan side-effect baru.

4. Penanganan konflik (409):
   - Bila server mendeteksi bahwa `Idempotency-Key` yang sama digunakan untuk membuat resource yang berbeda atau terjadi kondisi domain conflict, server mengembalikan `409 Conflict` dengan body Problem Details menjelaskan `conflictType` dan `existingResourceId` bila relevan.
   - Klien disarankan untuk:
     - Jika ingin memastikan idempotensi, gunakan `Idempotency-Key` unik untuk percobaan baru; atau
     - Jika ingin meminta hasil sebelumnya, gunakan mekanisme `GET` terhadap `existingResourceId` bila tersedia.

Catatan implementasi minimal untuk mock server:
- Prism dapat dimock untuk memeriksa keberadaan header `Idempotency-Key` dan mengembalikan 400 jika absen; perilaku 24 jam dan mapping nyata adalah tanggung jawab backend (Service Owner).
