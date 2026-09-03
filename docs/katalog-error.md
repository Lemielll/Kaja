# Katalog Error — Problem Details (RFC 9457)

Semua response error menggunakan format Problem Details (RFC 9457) dengan media type `application/problem+json`.

Contoh skema Problem (ringkas):

```json
{
  "type": "https://example.com/probs/validation",
  "title": "Invalid request payload",
  "status": 400,
  "detail": "Field 'amount' harus berupa integer positif",
  "instance": "/v1/lease-payments",
  "errors": {"amount": "must be positive"}
}
```

Error umum:

- `400 Bad Request` — payload tidak valid atau field hilang. `type`: `https://example.com/probs/validation`.
- `401 Unauthorized` — token/credential tidak valid. `type`: `https://example.com/probs/unauthorized`.
- `403 Forbidden` — akses dilarang. `type`: `https://example.com/probs/forbidden`.
- `404 Not Found` — resource tidak ditemukan. `type`: `https://example.com/probs/not-found`.
- `409 Conflict` — konflik domain (mis. tanggal bentrok, duplicate idempotency). `type`: `https://example.com/probs/conflict`. Extended members:
  - `conflictType` (string) — mis. `idempotency_duplicate|date_overlap`
  - `existingResourceId` (string, optional) — id resource yang menyebabkan konflik
  - `availableDates` (array, optional) — untuk konflik jadwal, daftar tanggal alternatif
- `500 Internal Server Error` — kegagalan server tak terduga. `type`: `https://example.com/probs/internal`.

Praktik:
- Header `Content-Type: application/problem+json` jika mengembalikan Problem Details.
- Sertakan `instance` yang menunjukkan endpoint yang dipanggil.
- Gunakan `errors` atau `invalid-params` sebagai extension member untuk detail field-level.
