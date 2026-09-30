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
| Contractor creates a rental | Equipment catalogue | Contractor | `GET /equipments` | 1 |
| Contractor creates a rental | Rental confirmation | Contractor | `POST /rentals` | 1 |
| Contractor creates a rental | Rental result/detail | Contractor | `GET /rentals/{id}` | 1 |
| Contractor tracks a rental | Rental list | Contractor | `GET /rentals` | 1 |
| Contractor tracks a rental | Rental detail | Contractor | `GET /rentals/{id}` | 1 |
| Field operator submits an inspection | Inspection form for an assigned rental | Field operator | `POST /rentals/{id}/inspections` | 1 |

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
- The inspection workflow assumes the field operator already has the assigned
  rental identifier. There is no operation to list assigned rentals or read
  inspection history, so the client must receive that assignment context from
  the surrounding application flow; it must not invent a new endpoint.

## Client Web (Client Owner)

Run the web application from `clients/web` with `npm install`, copy
`.env.example` to `.env`, then run `npm run dev`. Vite uses
`http://localhost:3000`, which matches the registered Keycloak callback. The
web client uses Authorization Code + PKCE as a public client. Access tokens and
the active OIDC user stay in memory; `localStorage` is not used. OIDC transaction
state is temporary in `sessionStorage` so the PKCE callback can be verified
after redirect. No persistent refresh token or silent renewal is implemented;
a `401` clears the in-memory session and asks the user to sign in again. This
does not meet the proposed `HttpOnly` refresh-cookie design, which requires a
server-side BFF or an explicit architecture decision. Sign-out uses the
RP-Initiated Logout endpoint advertised by OIDC discovery and clears local
session state. Because the API validates self-contained JWTs, an access token
already issued may remain valid until it expires.

The deployed API base URL is configured through `VITE_API_BASE_URL`. All client
network calls belong in `clients/web/src/lib/api.ts`. Current web integration
works from `http://localhost:3000`; the deployed static-site origin still needs
to be added to the API's CORS allowlist. See
[`docs/temuan-ambiguitas-frontend.md`](docs/temuan-ambiguitas-frontend.md).
