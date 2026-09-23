# Client Owner Evidence - Session 4

Dokumen ini mencatat keputusan dan bukti dari sisi client. Jangan menulis access token,
refresh token, password, client secret, atau nilai `code_verifier` asli ke repository.

## 1. Client Classification

| Client | Classification | Flow | Holds a secret? | Redirect URI / deployment | Confirmation |
|---|---|---|---|---|---|
| Web | Public | Authorization Code + PKCE (S256) | No | Isi redirect URI exact match | Pending team review |
| Mobile | Public | Authorization Code + PKCE (S256) | No | Isi redirect URI exact match | Pending team review |
| Device | Public or confidential | PKCE or Client Credentials | Depends on deployment | Confirm whether user can inspect it | Pending architecture decision |
| MCP | Confidential if server-side | Client Credentials | Yes | Server-side deployment only | Pending architecture decision |

## 2. Client Security Checklist

- [x] Public client tidak memiliki client secret.
- [x] `code_verifier` dibuat acak sebelum login.
- [x] Hanya `code_challenge` dengan metode S256 dikirim saat authorization request.
- [x] `state` dibuat terpisah dari PKCE dan diverifikasi saat callback.
- [x] Redirect URI dicocokkan penuh tanpa wildcard.
- [x] Token tidak dimasukkan ke URL, `localStorage`, log, atau pesan error.
- [x] Access token browser disimpan hanya di memory.
- [x] Refresh token browser menggunakan cookie `HttpOnly`, `Secure`, `SameSite`.
- [x] Android menggunakan Keystore atau `EncryptedSharedPreferences`.
- [x] iOS menggunakan Keychain.
- [x] Secret server-side disimpan di secret manager.

## 3. Client Error Handling

| Response | Client behavior | Security requirement |
|---|---|---|
| `401 Unauthorized` | Hapus sesi lokal yang kedaluwarsa dan mulai login ulang. Jangan retry tanpa token baru. | Jangan menampilkan access token atau detail token kepada user. |
| `403 Forbidden` | Tampilkan akses ditolak dan jangan mengulang request yang sama tanpa perubahan scope/session. | Jangan menyamarkan kekurangan scope sebagai login gagal. |
| `404 Not Found` | Tampilkan resource tidak ditemukan tanpa menyimpulkan apakah resource milik user lain. | Perlakukan response yang sama untuk object yang tidak ada dan object milik principal lain. |
| Refresh ditolak karena reuse | Hapus seluruh sesi/token lokal dan minta login ulang. | Jangan mencoba memakai refresh token lama atau menyimpan salinannya. |

Client harus menangani response `application/problem+json` tanpa mengandalkan
pesan error bebas sebagai identifier perilaku. Gunakan status code dan field
problem yang telah ditetapkan kontrak.

## 4. Refresh Token Rotation Evidence

### Preconditions

- Keycloak realm dan client sudah aktif.
- Refresh token rotation dan reuse detection sudah diaktifkan.
- Gunakan akun test khusus; jangan masukkan credential atau token asli ke dokumen.
- Simpan hanya status HTTP, timestamp, dan hasil redacted.

### Test procedure

1. Login dan simpan refresh token pertama sebagai `RT1` di environment variable lokal.
2. Tukarkan `RT1` untuk access token baru dan refresh token kedua `RT2`.
3. Catat bahwa `RT2` berbeda dari `RT1`.
4. Gunakan kembali `RT1`; request harus ditolak.
5. Gunakan `RT2` setelah reuse `RT1` terdeteksi; request juga harus ditolak.

### Evidence record

| Check | Expected | Actual | Result | Date |
|---|---|---|---|---|
| `RT2 != RT1` | True | Pending Keycloak | Pending | 2026-09-23 |
| Reuse `RT1` | Rejected | Pending Keycloak | Pending | 2026-09-23 |
| Reuse `RT2` after `RT1` detection | Rejected | Pending Keycloak | Pending | 2026-09-23 |

## 5. Open Decisions

- [ ] Confirm whether Device communicates directly with the API or through a trusted backend.
- [ ] Confirm whether MCP is deployed as a server-side integration.
- [ ] Confirm exact redirect URIs for Web and Mobile.
- [ ] Confirm whether automated tests use local signing keys or a Keycloak test realm.
- [ ] Replace pending evidence values after the Service Owner enables rotation and reuse detection.
