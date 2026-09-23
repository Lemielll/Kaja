# ADR 0003: Authentication and Access Control

**Status:** Draft (keputusan client finalized; implementasi role lain masih berjalan)
**Date:** 2026-09-23  
**Deciders:** Tim Kaja (Heavy Equipment Rental System)

## Context

Session 4 membutuhkan implementasi authentication dan authorization untuk melindungi resource API. Service harus dapat memverifikasi identitas pengguna dan menegakkan aturan akses berdasarkan scope OAuth 2.0.

## Decision

### 1. Authorisation Server

**Pilihan:** Keycloak 26.0 self-hosted via Docker

**Alasan:**
- Mendukung refresh token rotation with reuse detection (requirement wajib untuk Step 10)
- Open source, dapat di-deploy lokal untuk development dan testing
- Mendukung OAuth 2.0 + OpenID Connect standard
- Mendukung PKCE untuk public client (web/mobile)
- Tersedia discovery document (`.well-known/openid-configuration`)

**Konfigurasi:**
- Mode: `start-dev` untuk development
- Port: 8080
- Admin console: `http://localhost:8080`
- File konfigurasi: `infra/docker-compose.auth.yml`

### 2. Cara Test Mendapat Token

**Pilihan:** Direct Grant (Resource Owner Password Credentials) untuk automated testing

**Alasan:**
- Memudahkan automated test tanpa perlu browser interaction
- Cukup untuk environment development dan CI
- Test user credentials dapat di-manage di Keycloak
- Hafidz (Integration Owner) akan menggunakan ini di Step 11 untuk contract test

**Catatan:** Production client akan menggunakan Authorization Code + PKCE, bukan direct grant.

### 3. Domain Actors

Berdasarkan `openapi.yaml` Heavy Equipment Rental System:

| Actor | Deskripsi | Use Case |
|-------|-----------|----------|
| **Contractor** | Penyewa alat berat | Membuat rental, melihat rental sendiri, melakukan pembayaran |
| **Warehouse Admin** | Admin gudang | Menyetujui/reject rental, mengelola equipment availability |
| **Field Operator** | Operator lapangan | Melakukan inspection, update status equipment |

### 4. Scope Vocabulary (Draft - menunggu finalisasi dari Dhafin)

Scope menggunakan format `resource:action` sesuai kontrak Step 2.

**Equipment Resource:**
- `equipments:read` - List dan read equipment
- `equipments:write` - Update equipment status

**Rental Resource:**
- `rentals:read` - List dan read rental records
- `rentals:write` - Create dan update rental
- `rentals:approve` - Approve/reject rental (admin only)

**Inspection Resource:**
- `inspections:write` - Create inspection report
- `inspections:read` - Read inspection history

**Payment Resource:**
- `payments:write` - Process payment
- `payments:read` - View payment history

⚠️ **PENTING:** Scope final harus identik persis dengan yang didefinisikan oleh Dhafin (Contract Owner) di Step 2. Koordinasi diperlukan sebelum melanjutkan Step 3c (definisi scope di Keycloak).

### 5. Token Strategy

**Access Token:**
- Format: JWT signed with RS256
- Lifetime: 15 menit (recommendation OAuth 2.0 Security Best Practices)
- Audience: `kaja-api` (nama service)
- Issuer: Keycloak realm URL

**Refresh Token:**
- Rotation: Enabled
- Reuse Detection: Enabled (akan diverifikasi Ajie di Step 10)
- Lifetime: 30 hari

**Testing strategy:**
- Automated token testing menggunakan local Keycloak realm dan client `test-cli`.
- Direct Grant hanya aktif pada `test-cli` untuk testing lokal/CI, bukan pada
	`web-app` production.
- Evidence rotation dan reuse detection dijalankan terhadap local Keycloak.

### 6. Client Classification

Klasifikasi ditentukan berdasarkan apakah pengguna aplikasi dapat membaca nilai
yang tersimpan di aplikasi. Client public tidak boleh diberi secret karena nilai
tersebut dapat diekstrak dari browser, APK, atau perangkat pengguna.

| Client | Classification | OAuth flow | Holds a secret? | Status |
|--------|----------------|------------|-----------------|--------|
| Web | Public | Authorization Code + PKCE (S256) | No | Decided |
| Mobile | Public | Authorization Code + PKCE (S256) | No | Decided |
| Device | Public | Authorization Code + PKCE (S256) | No | Decided |
| MCP | Confidential | Client Credentials | Yes | Decided |

Keputusan Client Owner:

- Device diperlakukan sebagai public client karena aplikasi/perangkat yang
	digunakan langsung user tidak dapat menyembunyikan secret.
- MCP diperlakukan sebagai confidential client karena diasumsikan berjalan
	sebagai service server-side. Secret wajib berada di secret manager.
- Device menggunakan alur PKCE karena client yang dapat diinspeksi user tidak
	dapat menyembunyikan secret.
- MCP menggunakan Client Credentials karena diasumsikan berjalan sebagai
	service server-side.

Redirect URI konfigurasi awal:

- Web callback: `http://localhost:3000/callback`
- Web silent renew: `http://localhost:3000/silent-renew`
- Mobile callback yang diusulkan: `com.kaja.mobile:/oauth/callback`

URI Mobile ditetapkan sebagai `com.kaja.mobile:/oauth/callback`. Semua URI wajib
didaftarkan sebagai exact match.

Aturan untuk public client:

- `code_verifier` acak dibuat sebelum login; hanya `code_challenge` S256 dikirim ke authorization server.
- `state` dibuat terpisah dari PKCE untuk melindungi callback dari request yang tidak berkaitan.
- Redirect URI harus dicocokkan penuh tanpa wildcard.
- Direct access grants/password flow: OFF untuk client produksi.
- Access token tidak boleh dimasukkan ke URL, `localStorage`, log, atau pesan error.

Aturan untuk confidential client:

- Client authentication dan service account: ON bila memang dibutuhkan.
- Client secret hanya disimpan di secret manager dan tidak boleh masuk repository.
- Standard browser flow: OFF untuk background job yang hanya memakai Client Credentials.

### 7. Token Storage by Platform

| Platform | Access token | Refresh token | Catatan |
|----------|--------------|---------------|---------|
| Browser | Memory aplikasi | Cookie `HttpOnly`, `Secure`, `SameSite` | Jangan gunakan `localStorage` atau URL |
| Android | Memory aplikasi | Android Keystore / `EncryptedSharedPreferences` | Jangan hardcode secret di APK |
| iOS | Memory aplikasi | Keychain | Jangan hardcode secret di aplikasi |
| Server job / MCP | Memory proses seminimal mungkin | Secret manager atau mekanisme server-side yang disetujui | Jangan commit secret |

Refresh token harus dipakai melalui rotation. Client wajib mengganti refresh
token lama dengan token baru setiap refresh dan menghapus sesi lokal jika server
menolak refresh karena reuse terdeteksi.

### 8. Test Users

6 test user untuk automated testing:

| Username | Role | Purpose |
|----------|------|---------|
| `contractor-a` | Contractor | Normal contractor operations |
| `contractor-b` | Contractor | Multi-user testing |
| `warehouse-admin-a` | Warehouse Admin | Approval workflows |
| `warehouse-admin-b` | Warehouse Admin | Multi-admin testing |
| `field-operator-a` | Field Operator | Inspection operations |
| `field-operator-b` | Field Operator | Multi-operator testing |

Password untuk test user disimpan di `.env` (tidak di-commit).

## Implementation Evidence

### Service Owner (Arnoldus) - Step 3, 5, 6, 9

- [x] Keycloak Docker setup (`infra/docker-compose.auth.yml`)
- [x] Dokumentasi keputusan ini
- [ ] Realm creation dan scope definition (menunggu scope final dari Dhafin)
- [ ] Client registration (public + confidential)
- [ ] Test user creation
- [ ] Skeleton folder auth (`service/src/auth/`)
- [ ] Layer 1 authentication implementation
- [ ] Token redaction dari log

### Client Owner - Step 1 dan Step 10

- [x] Klasifikasi Web dan Mobile sebagai public client
- [x] Aturan PKCE, `state`, redirect URI, dan penyimpanan token didokumentasikan
- [x] Menetapkan klasifikasi final Device dan MCP
- [x] Menetapkan redirect URI Web dan Mobile
- [x] Evidence refresh token rotation
- [x] Evidence reuse detection

### Contract Owner (Dhafin) - Step 2, 4

- [x] Finalisasi scope vocabulary di `service/README.md`
- [x] Update OpenAPI dengan security scheme

### Service/Integration Owner - Step 7, 8, 11

- [ ] Layer 2 authorization middleware (`require-scope.js`)
- [ ] Layer 3 ownership predicates
- [ ] Automated authorization tests

## Consequences

**Positive:**
- Standard OAuth 2.0 + OIDC, mudah diintegrasikan dengan berbagai client
- Token verification cryptographic-based, tidak perlu hit database
- Refresh token rotation meningkatkan keamanan
- Self-hosted Keycloak memberikan kontrol penuh untuk testing

**Negative:**
- Tambahan dependency (Keycloak container) untuk development
- Butuh koordinasi ketat untuk scope vocabulary (string harus identik persis)
- Perlu setup tambahan untuk production deployment

## References

- OAuth 2.0 Security Best Practices (RFC 8252, RFC 8628)
- OpenID Connect Core 1.0
- Keycloak Documentation 26.0
- Session 4 Assignment - Authentication and Access Control
