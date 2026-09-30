# Contract changelog

## 2026-09-30 — Contract Owner: Conditional inspection writes

Versi API: **1.2.0 → 1.3.0**. This backward-compatible addition documents the
service's existing optimistic-concurrency behavior for inspection creation.

### Ditambahkan

- Optional `If-Match` on `POST /rentals/{id}/inspections`.
- `412 Precondition Failed` with an `application/problem+json` body and the
  current `ETag` when the supplied strong entity tag does not match.

### Keputusan

- `If-Match` remains optional; omitting it does not produce `428`.
- Clients should refresh the rental representation after `412` before retrying.

## 2026-09-30 — Contract Owner: Conditional GET validators

Versi API: **1.1.0 → 1.2.0**. This backward-compatible addition lets clients
validate cached GET representations without retransmitting unchanged bodies.

### Ditambahkan

- Optional `If-None-Match` request header and `ETag` response header for
  `GET /equipments`, `GET /rentals`, and `GET /rentals/{id}`.
- `304 Not Modified` responses with no body for matching validators.
- Deterministic representation-specific ETags, including the current query
  filters, so validators identify the selected representation.

### Tidak diubah

- Collection pagination is not introduced; the current collection contract
  does not define pagination.

## 2026-09-30 — Contract Owner: Structured validation details

Versi API: **1.0.0 → 1.1.0**. This backward-compatible addition standardizes
field-level validation details without changing existing status-code semantics.

### Ditambahkan

- Optional `Problem.invalid-params`, an array of `{ field, reason }` entries,
  with examples for malformed or missing `Idempotency-Key` (`400`) and a
  business-rule validation failure (`422`).
- Contract guidance for clients to associate validation feedback with the
  relevant request field.

### Dipertahankan

- Missing or malformed `Idempotency-Key` remains `400 Bad Request`.
- `422 Unprocessable Entity` remains reserved for structurally valid requests
  that violate a business rule.
- The required `Idempotency-Key` header and its UUID format are unchanged.

## 2026-09-23 — Contract Owner: Authentication and authorization boundary

Versi API: **0.1.1 → 1.0.0**. This is a breaking change because all existing
`/v1` operations now require OAuth 2.0 authentication and the required scope.

### Ditambahkan

- OAuth 2.0 `oauth2` security scheme with four capability-based scopes:
  `equipment:read`, `rentals:read`, `rentals:write`, and `inspections:write`.
- Protected-by-default document security with explicit scope requirements on
  every operation.
- Reusable `401 Unauthorized` and `403 Forbidden` responses.
- Consistent `404 Not Found` semantics for both missing and caller-inaccessible
  objects, preventing object ID enumeration.

### Konsekuensi kompatibilitas

Clients must obtain and send a valid bearer token with the required scope. The
public health endpoint is outside this API document and remains unauthenticated.

## 2026-09-10 — Contract Owner: Kontrak Final v0.1.1

Versi API: **0.1.0 → 0.1.1** (final contract lock; tidak ada perubahan pada field wajib atau endpoint, hanya klarifikasi status code dan perbaikan contoh error yang sebelumnya ambigu).

### Keputusan Resmi Contract Owner

- **Missing `Idempotency-Key` = 400 Bad Request**.
- **422 Unprocessable Entity** hanya untuk request yang structurally valid tetapi melanggar aturan bisnis, misalnya `startTime >= endTime`, periode rental terlalu singkat, atau inspeksi sebelum rental aktif.
- **409 Conflict** didefinisikan untuk konflik bisnis/idempotency: jadwal bentrok, reuse key dengan body berbeda, request masih dalam proses, dan inspeksi duplikat.
- **`POST /rentals/{id}/inspections`** harus mencantumkan `409` dan `422` dalam reusable error responses, sesuai dengan skema final.

> Keputusan ini dibuat untuk menghindari perubahan kontrak hanya demi membuat test hijau. Status code dan contoh problem detail dibakukan berdasarkan semantik HTTP dan business rule, bukan berdasarkan implementasi mock sementara.

### Perubahan resmi ke `openapi.yaml`

- Klarifikasi bahwa header `Idempotency-Key` yang hilang atau salah format adalah **400**.
- Contoh `BadRequest` diarahkan ke skenario yang benar: missing/malformed required header.
- Contoh `UnprocessableEntity` tetap pada skenario business rule yang benar, yaitu valid-format tetapi melanggar aturan bisnis.
- Reusable response `409` dan `422` untuk inspeksi telah dipertahankan dan dijaga konsisten dengan endpoint yang relevan.

### Catatan final

- `openapi.yaml` adalah kontrak final untuk fase implementasi lanjutan.
- Tidak ada perubahan kontrak yang dibuat untuk memenuhi hasil test semata.
- Perubahan ini dicatat sebagai keputusan resmi Contract Owner; implementasi lain harus mengikuti kontrak ini tanpa membelokkan semantics status code.

---

## 2026-09-10 — Contract Owner (Schema Validation Layer)

Versi API: **0.1.0** (tidak ada perubahan kontrak publik; semua perubahan bersifat implementasi internal).

### Ditambahkan

- **`service/src/schemas/common.js`** — Primitif validasi bersama yang mencerminkan `openapi.yaml` secara 1:1:
  - `OPAQUE_ID_PATTERN` (`^[a-z]+_[A-Za-z0-9]{6,12}$`), `CURRENCY_PATTERN` (`^[A-Z]{3}$`), `UUID_PATTERN` (RFC 4122), `DATETIME_PATTERN` (ISO 8601).
  - Helper: `isValidOpaqueId`, `isValidCurrency`, `isValidUUID`, `isValidDatetime`, `isValidInteger`, `isValidEnum`.

- **`service/src/schemas/equipments.js`** — Validasi query `GET /equipments`:
  - `status` enum: `available | reserved | in_progress | maintenance | out_of_service`.
  - `type` enum: `excavator | wheel_loader | bulldozer | crane | compactor`.
  - Keduanya opsional; jika ada dan tidak sesuai enum → **400 Bad Request**.

- **`service/src/schemas/rentals.js`** — Validasi untuk seluruh endpoint `/rentals`:
  - `GET /rentals`: query `status` enum (7 nilai).
  - `POST /rentals`: header `Idempotency-Key` (required, uuid) + body (7 field required, pattern/format/minimum).
  - `GET /rentals/{id}` & `POST /rentals/{id}/inspections`: path param `id` (opaque ID pattern).

- **`service/src/schemas/inspections.js`** — Validasi body `POST /rentals/{id}/inspections`:
  - Required: `equipmentId`, `operatorId`, `status`, `inspectedAt`, `notes`.
  - `status` enum: `pending_review | in_progress | pass | fail`.

- **`service/src/schemas/index.js`** — Titik ekspor tunggal untuk semua middleware validasi.

- **`service/src/problem.js`** — Helper RFC 9457 Problem Details sesuai `components/schemas/Problem`:
  - `badRequest` (400), `notFound` (404), `conflict` (409), `unprocessable` (422), `internalError` (500).

### Catatan Contract Owner

- `openapi.yaml` **tidak diubah** dalam sesi ini. Versi tetap `0.1.0`.
- Setiap enum, pattern, dan required field di `service/src/schemas/` disalin verbatim dari `openapi.yaml`.
- Perubahan `openapi.yaml` di masa depan **harus** melalui review Contract Owner dan dicatat di sini.

---

## 2026-09-03

- Menambahkan `Idempotency-Key` wajib pada `POST /rentals/{id}/inspections` dan mendokumentasikan `Retry-After` untuk request idempoten yang masih diproses.
- Menambahkan contoh RFC 9457 dan URI `Problem.type` stabil pada reusable error responses.
- Menyelaraskan dokumentasi resource, error, idempotency, mock, dan domain.
- Menambahkan skeleton `service/` dan seluruh direktori `clients/` yang diwajibkan tugas.
