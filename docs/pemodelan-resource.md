# Pemodelan Resource (B.1)

Dokumen ini menjabarkan skema resource utama yang digunakan dalam API.

## Skema Utama

1) LeasePayment
- description: Representasi pembayaran lease/kontrak.
- required: `id`, `leaseId`, `amount`, `currency`, `status`, `createdAt`
- properties:
  - `id` (string, format: uuid) — identifier unik pembayaran. contoh: `"e7a1b8e2-..."`
  - `leaseId` (string) — referensi ke resource `Lease`. contoh: `"L-123"`
  - `amount` (integer) — jumlah dalam sen/integer terkecil. contoh: `1000000`
  - `currency` (string) — kode mata uang ISO 4217. contoh: `"IDR"`
  - `status` (string) — `pending|completed|failed`. contoh: `"pending"`
  - `createdAt` (string, format: date-time) — timestamp pembuatan.

Example:

```json
{
  "id": "e7a1b8e2-4f6a-4d1b-9f3a-0d2a8f3b9c1a",
  "leaseId": "L-123",
  "amount": 1000000,
  "currency": "IDR",
  "status": "pending",
  "createdAt": "2026-09-03T08:00:00Z"
}
```

2) Lease
- description: Representasi kontrak sewa/lease.
- required: `id`, `startDate`, `endDate`, `tenantId`, `amountPerPeriod`
- properties: `id` (string), `startDate` (date), `endDate` (date), `tenantId` (string), `amountPerPeriod` (integer)

Example:

```json
{
  "id": "L-123",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "tenantId": "T-55",
  "amountPerPeriod": 1000000
}
```

3) PaymentMethod
- description: Metode pembayaran yang terdaftar untuk lease.
- required: `type`
- properties: `type` (string, enum: `card|bank_transfer|cash`), `details` (object, optional)

Example:

```json
{
  "type": "bank_transfer",
  "details": { "bank": "BCA", "account": "1234567890" }
}
```

## Kandidat Pemodelan yang Ditolak (minimal 2)

1) Menggabungkan `Lease` dan `LeasePayment` jadi satu resource `LeaseWithPayments`
- Alasan penolakan: memecah resource lebih baik untuk skenario pagination dan pemrosesan asynchronous pada pembayaran; menggabungkan menambah ukuran payload dan merumitkan partial updates.

2) Menyimpan `amount` sebagai string berformat "1.000.000"
- Alasan penolakan: angka harus disimpan sebagai integer (smallest unit) agar konsistensi, sorting, dan perhitungan tidak terpengaruh lokal formatting.

Catatan: Jika ada kebutuhan representasi lain (mis. multi-currency rounding), diskusikan sebagai ekstensi atau field terpisah.
