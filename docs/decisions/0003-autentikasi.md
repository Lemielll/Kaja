# ADR 0003: Authentication and Access Control

**Status:** Draft (menunggu finalisasi scope dari Contract Owner)  
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

### 6. Client Classification

**Public Client (web-app):**
- Untuk web dan mobile application
- No client secret
- PKCE required (S256)
- Authorization Code flow
- Valid redirect URIs (full match, no wildcard)
- Direct access grants: OFF

**Confidential Client (background-jobs):**
- Untuk scheduled jobs atau service-to-service
- Client authentication: ON
- Service account: ON
- Client secret disimpan di secret manager (TIDAK di repo)
- Standard flow: OFF

### 7. Test Users

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

### Integration Owner (Ajie) - Step 10

- [ ] Evidence refresh token rotation
- [ ] Evidence reuse detection

### Contract Owner (Dhafin) - Step 2, 4

- [ ] Finalisasi scope vocabulary di `service/README.md`
- [ ] Update OpenAPI dengan security scheme

### Client Owner (Hafidz) - Step 7, 8, 11

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
