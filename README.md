# Anggota Kelompok & Peran (Pertemuan 2)

| Nama Anggota                      | Peran                 | NIM                | Username Github | Tanggung Jawab                                                                                                                    |
| :-------------------------------- | :-------------------- | :----------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Arnoldus Dharma Wasesa Mahasmara | **Contract Owner**    | 24/545535/PA/23182 | Arnold-XV        | Pemegang tanggung jawab atas `openapi.yaml` . Setiap perubahan antarmuka ditinjau oleh peran ini, terlepas dari siapa penulisnya. |
| Hafidz Kurniawan Nahruntoko       | **Service Owner**     | 24/539859/PA/22920 | DaisyDazy       | Backend yang di-deploy, konfigurasi, migrasi, dan health endpoint-nya.                                                            |
| Muhammad Dhafin Alfeizar Gandhang  | **Client Owner**      | 24/539735/PA/22916 | Lemielll       | Klien yang dihadapi pengguna, serta pelaporan tertulis atas setiap ambiguitas yang ditemukan dalam kontrak.                       |
| Ajie Armansyah Sunaryo                    | **Integration Owner** | 24/545286/PA/23170            | AjieArmansyahSunaryo        | Mock server, contract test, dan koordinasi dengan kelompok mitra pada Pertemuan 7.                                                |

## Mock server & runbook

Berikut langkah singkat untuk menjalankan mock server Prism dan contoh panggilan `curl` untuk demonstrasi.

Prerequisites:
- Node.js / `npx` tersedia di mesin demonstrasi.

Validasi spesifikasi OpenAPI (opsional, direkomendasikan):

```bash
npx redocly lint openapi.yaml
```

Menjalankan Prism mock server (default port 4010):

```bash
npx @stoplight/prism-cli mock openapi.yaml
```

Contoh perintah lengkap tersedia pada bagian [Contoh curl](#contoh-curl) di bawah.

Catatan:
- Endpoint dan body mengikuti skema aktual di `openapi.yaml`.
- Ekspektasi status code dan body error mengikuti format RFC 9457 (Problem Details).

---

Referensi struktur contract tests: lihat `tests/contract/`.

## Dokumentasi Kontrak

- [Resource modeling (B.1)](docs/resource-modeling.md)
- [Error catalog (B.4)](docs/error-catalog.md)
- [Idempotency policy](docs/idempotency.md)
- [Compatibility policy (B.5)](docs/compatibility-policy.md)
- [Mock usage](docs/mock-usage.md)


## Menjalankan validator

```bash
npm init -y
npm install --save-dev @redocly/cli
npx redocly lint openapi.yaml
```

## Menjalankan mock server

```bash
npx @stoplight/prism-cli mock openapi.yaml
```

## Contoh curl

### 1) Ambil daftar equipment

```bash
curl.exe -i http://127.0.0.1:4010/equipments
```

### 2) Buat rental dengan Idempotency-Key

```powershell
curl.exe -i -X POST "http://127.0.0.1:4010/rentals" `
  -H "Idempotency-Key: 0f7c1b9e-3d21-4a6f-9c05-8e2b7d41a9f0" `
  -H "Content-Type: application/json" `
  --data '{"equipmentId":"eqp_8X2kAB","contractorId":"ctr_72Xp9C","warehouseAdminId":"adm_19Lq2f","startTime":"2026-09-15T08:00:00Z","endTime":"2026-09-18T17:00:00Z","depositAmount":150000,"currency":"USD"}'
```

### 3) Request tanpa Idempotency-Key

```powershell
curl.exe -i -X POST "http://127.0.0.1:4010/rentals" `
  -H "Content-Type: application/json" `
  --data '{"equipmentId":"eqp_8X2kAB","contractorId":"ctr_72Xp9C","warehouseAdminId":"adm_19Lq2f","startTime":"2026-09-15T08:00:00Z","endTime":"2026-09-18T17:00:00Z","depositAmount":150000,"currency":"USD"}'
```

## Catatan

- Semua identifier bersifat opaque dan server-generated.
- Semua status memakai enum tertutup dan klien harus menangani nilai yang tidak dikenal sebagai `in_progress`.
- Semua nilai uang menggunakan integer dalam minor unit mata uang.
- Semua error mengikuti RFC 9457 `application/problem+json`.

# Anggota Kelompok & Peran (Pertemuan 4)

| Nama Anggota                      | Peran                 | NIM                | Username Github | Tanggung Jawab                                                                                                                    |
| :-------------------------------- | :-------------------- | :----------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Arnoldus Dharma Wasesa Mahasmara | **Service Owner**     | 24/545535/PA/23182 | Arnold-XV        | Backend yang di-deploy, konfigurasi, migrasi, dan health endpoint-nya.  |
| Hafidz Kurniawan Nahruntoko       |  **Integration Owner**    | 24/539859/PA/22920 | DaisyDazy       |  Mock server, contract test, dan koordinasi dengan kelompok mitra pada Pertemuan 7.                                                             |
| Muhammad Dhafin Alfeizar Gandhang  | **Contract Owner**      | 24/539735/PA/22916 | Lemielll       | Pemegang tanggung jawab atas `openapi.yaml`. Setiap perubahan antarmuka ditinjau oleh peran ini, terlepas dari siapa penulisnya.                        |
| Ajie Armansyah Sunaryo                    | **Client Owner** | 24/545286/PA/23170            | AjieArmansyahSunaryo        | Klien yang dihadapi pengguna, serta pelaporan tertulis atas setiap ambiguitas yang ditemukan dalam kontrak.                                                |

## Session 5 - Workflow A.1

The web application is limited to workflows that use operations already
published in `openapi.yaml`. The call count is the number of service requests
needed before each screen can render its data; navigation and local form state
do not count as service calls.

| Workflow | Screen | Permitted role | Operation in `openapi.yaml` | Service calls |
| :-------- | :----- | :------------- | :--------------------------- | ------------: |
| Contractor creates a rental | Equipment catalogue (`/equipments`) | Contractor | `GET /equipments` | 1 |
| Contractor creates a rental | Rental request form (`/rentals/new`) | Contractor | `POST /rentals` | 1 |
| Contractor creates a rental | Rental result/detail (`/rentals/{id}`) | Contractor | `GET /rentals/{id}` | 1 |
| Contractor tracks a rental | Rental list (`/rentals`) | Contractor | `GET /rentals` | 1 |
| Contractor tracks a rental | Rental detail (`/rentals/{id}`) | Contractor | `GET /rentals/{id}` | 1 |
| Field operator submits an inspection | Assigned inspections queue (`/inspection`) | Field operator | `GET /rentals` | 1 |
| Field operator submits an inspection | Inspection audit form (`/rentals/{id}/inspection`) | Field operator | `POST /rentals/{id}/inspections` | 1 |

### Contract validation and findings for workflow planning

The Contract Owner verified that every operation listed in the A.1 workflow
table exists in `openapi.yaml`: `GET /equipments` (`listEquipments`),
`GET /rentals` (`listRentals`), `POST /rentals` (`createRental`),
`GET /rentals/{id}` (`getRentalById`), and
`POST /rentals/{id}/inspections` (`createInspection`). No listed operation is
missing from the contract.

- The contract has no operation for a contractor to check equipment
  availability for a requested time range; the client can only use the
  published equipment status and submit the rental request.
- The contract has no operation for a warehouse admin to approve or reject a
  rental. Warehouse review is therefore not selected as an end-to-end
  workflow until that capability is added through a reviewed contract change.
- The field operator inspection workflow uses `GET /rentals` to display assigned
  rentals scoped to the operator's identity, and navigates to the inspection
  form using the assigned rental ID without inventing non-contract endpoints.

## Client Web (Client Owner)

### Session Storage Decision (A.3 Item 5)

The active OIDC session and access tokens are stored in the browser's `localStorage`
using `WebStorageStateStore`. This design decision ensures that user sessions persist
reliably across page reloads (F5) and across browser tabs, enabling URL bookmarking
and multi-window workflows as evaluated in Grader Test #2 and #3.

**Security Consequence:** Storing tokens in `localStorage` makes them accessible to
any script running in the application's origin, which increases exposure to Cross-Site
Scripting (XSS) attacks. A more restrictive architecture would use `HttpOnly` cookies
managed by a Backend-for-Frontend (BFF) proxy service, preventing JavaScript access
entirely at the cost of additional infrastructure complexity.

Run the web application from `clients/web` with `npm install`, copy `.env.example`
to `.env`, then run `npm run dev`. The web client uses Authorization Code + PKCE
against Keycloak OIDC. Sign-out clears the local session and triggers RP-Initiated
Logout.

The deployed API base URL is configured through `VITE_API_BASE_URL`. All client
network calls belong in `clients/web/src/lib/api.ts`. Current web integration
runs on `http://localhost:3000` connecting to API on `http://localhost:4010/v1`.

## Akun Uji Demonstrasi (Session 7 Demo)

| Peran (Role) | Test Account | Password | Scopes / Perizinan | Skenario Demonstrasi |
| :--- | :--- | :--- | :--- | :--- |
| **Contractor** | `contractor-a` | `test123` | `rentals:read`, `rentals:write`, `equipment:read` | Workflow 1 & 2: Buat sewa & lacak kontrak |
| **Field Operator** | `field-operator-a` | `test123` | `inspections:write`, `rentals:read` | Workflow 3: Lakukan audit inspeksi fisik |
| **Warehouse Admin** | `warehouse-admin-a` | `test123` | `rentals:read`, `equipment:read` | Verifikasi armada & inventaris gudang |

