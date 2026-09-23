# Integration Owner Evidence — Session 4: Authentication & Access Control

Dokumen ini mencatat bukti teknis implementasi, strategi token pengujian, dan hasil verifikasi test suite kontrol akses dari sisi **Integration Owner (Hafidz)** sesuai standar IEEE 829.

---

## 1. Test Token Strategy (Step 11a)

Sesuai ketentuan Session 4 §11a, tim memilih pendekatan **Local Test Key (Recommended)**:

- **Mekanisme**:
  - Keypair asimetris RS256 dihasilkan secara in-memory saat runtime test via `jose` (`tests/helpers/tokens.js`).
  - Mini JWKS HTTP server dijalankan secara lokal pada `http://127.0.0.1:9999/jwks.json` untuk menyajikan public JWK ke service middleware `verify.js`.
  - Token ditandatangani menggunakan private key lokal dengan `issuer: https://test.local/` dan `audience: kaja-api`.
- **Keuntungan**:
  - Test suite berjalan 100% terisolasi tanpa memerlukan container Keycloak aktif di background.
  - Sangat cepat (orde milidetik) dan bebas dari flakiness jaringan/port timeout pada runner CI.
  - Kunci privat tidak pernah keluar dari memori proses pengujian.

---

## 2. Boundary Test Specification & Matrix (Step 11b)

Lokasi test suite: `service/tests/authz/authz.test.js`  
Command eksekusi: `npm run test:authz`

| ID Test | Lapisan Uji | Boundary yang Diuji | Identitas Caller | Resource Target | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| `TC-AUTHZ-01` | **Layer 3 (Object)** | Contractor A membaca rental milik Contractor B | `ctr_contractorA` (scope: `rentals:read`) | `/v1/rentals/rnt_ContractorB` | `404 Not Found` (Problem Details identik dengan non-existent ID) | `404 Not Found` | **PASS** |
| `TC-AUTHZ-02` | **Layer 3 (Object & Mutation)** | Operator B mengirim inspeksi dengan `operatorId` Operator A | `opr_operatorB` (scope: `inspections:write`) | `POST /v1/rentals/rnt_ContractorA/inspections` | `404 Not Found` dan **0 mutasi database** | `404 Not Found` (count DB tetap) | **PASS** |
| `TC-AUTHZ-03` | **Layer 2 (Scope)** | Contractor memanggil endpoint inspeksi khusus operator | `ctr_contractorA` (scope: `rentals:read`, `rentals:write`) | `POST /v1/rentals/.../inspections` | `403 Forbidden` (`insufficient_scope`) sebelum handler dipanggil | `403 Forbidden` | **PASS** |
| `TC-AUTHZ-04` | **Layer 3 (Object)** | Warehouse Admin A membaca rental milik Warehouse B | `adm_warehouseA` (scope: `rentals:read`) | `/v1/rentals/rnt_ContractorB` | `404 Not Found` (bukan 403) | `404 Not Found` | **PASS** |
| `TC-AUTHZ-05` | **Layer 1 (Auth)** | Request tanpa header `Authorization` atau token yang dirusak (tampered) | Tanpa Token / Forged Payload | `/v1/rentals` | `401 Unauthorized` (`invalid_token`) | `401 Unauthorized` | **PASS** |
| `TC-AUTHZ-06` | **Layer 1 (Public)** | Request ke endpoint health check platform | Publik (tanpa token) | `GET /health` | `200 OK` (`status: "pass"`) | `200 OK` | **PASS** |

### Anti-Enumeration Proof (General Provision 4)
Pada `TC-AUTHZ-01`, respons terhadap objek yang ada tetapi bukan milik pemanggil (`/v1/rentals/rnt_ContractorB`) dibandingkan langsung dengan respons terhadap ID yang sama sekali tidak ada di database (`/v1/rentals/rnt_DoesNotEx`).
- `type`: `https://api.heavyrental.co/problems/resource-not-found` (identik)
- `title`: `Resource not found` (identik)
- `status`: `404` (identik)
- `contractorId` dan field internal objek: `undefined` (tidak ada kebocoran data)

---

## 3. Pembuktian Uji Merah-Hijau (Step 11c: Red-Green Verification)

Untuk membuktikan bahwa test benar-benar menguji boundary keamanan dan bukan sekadar *false positive*, dilakukan pengujian mutasi manual:

1. **Uji Merah (Pengecekan Dinonaktifkan Sementara)**:
   - Baris pengecekan `if (!ownership.mayReadRental(req.principal, row))` pada `service/src/routes/rentals.js` dikomentari.
   - Hasil eksekusi `node tests/authz/authz.test.js`:
     ```text
     [RUN] TC-AUTHZ-01: Layer 3 (Object Ownership - Contractor Read)...
     [FATAL TEST FAILURE]: AssertionError [ERR_ASSERTION]: Contractor A reading Contractor B rental must return 404 Not Found
     200 !== 404
     ```
   - **Hasil: MERAH (Gagal)** sesuai yang disyaratkan kurikulum.

2. **Uji Hijau (Pengecekan Diaktifkan Kembali)**:
   - Baris pengecekan kepemilikan dipulihkan.
   - Hasil eksekusi `node tests/authz/authz.test.js`:
     ```text
     PASS: TC-AUTHZ-01 (Layer 3: Contractor A reading B returns 404 identical to non-existent ID)
     ALL 5 AUTHORIZATION & ACCESS CONTROL BOUNDARY TESTS PASSED!
     ```
   - **Hasil: HIJAU (Lolos)**.

---

## 4. Verifikasi Regresi Contract Test Sesi 3 (Step 12b)

Seluruh suite contract test dari Sesi 3 disesuaikan konfigurasinya agar mengirimkan Bearer token valid tanpa mengubah kontrak OpenAPI:

- `client_contract_unit.js`: **PASS** (representasi DTO dan Problem Details RFC 9457)
- `service_store_unit.js`: **PASS** (unit store & parameterisasi SQL)
- `route_inspection_unit.js`: **PASS** (9/9 skenario rute dan business rule inspection berhasil lolos dengan Bearer token)
- `authz.test.js`: **PASS** (semua 5 boundary kontrol akses lolos)

Eksekusi komprehensif via `npm test`:
```text
> heavy-equipment-rental-service@0.1.0 test
> node tests/contract/client_contract_unit.js && node tests/contract/service_store_unit.js && node tests/contract/route_inspection_unit.js && node tests/authz/authz.test.js

PASS: client representation and Problem Details checks
PASS: Inspection store unit tests verified SQL parameterization, prepared statements, and DTO representation.
ALL IN-MEMORY ROUTE AND BUSINESS RULE CHECKS PASSED!
ALL 5 AUTHORIZATION & ACCESS CONTROL BOUNDARY TESTS PASSED!
```

---

## 5. Koordinasi Mitra & Integrasi Pertemuan 7 (Preparation)

Untuk kelompok mitra yang akan melakukan integrasi pada Pertemuan 7:
1. **Endpoint Autentikasi Publik**:
   - `/health` dapat di-ping tanpa token untuk memverifikasi liveness service.
2. **Format Header**:
   - Semua request ke `/v1/*` wajib menyertakan:
     ```http
     Authorization: Bearer <access_token>
     ```
3. **Scope yang Tersedia**:
   - `equipment:read`
   - `rentals:read`
   - `rentals:write`
   - `inspections:write`
4. **Respon Standard RFC 9457**:
   - Token tidak valid / tidak ada: `401 Unauthorized` dengan header `WWW-Authenticate: Bearer error="invalid_token"`
   - Scope tidak mencukupi: `403 Forbidden` dengan header `WWW-Authenticate: Bearer error="insufficient_scope", scope="..."`
   - Objek bukan milik caller / tidak ditemukan: `404 Not Found`
