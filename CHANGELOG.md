# Contract changelog

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
