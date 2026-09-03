# Anggota Kelompok & Peran (Pertemuan 2)

| Nama Anggota                      | Peran                 | NIM                | Username Github | Tanggung Jawab                                                                                                                    |
| :-------------------------------- | :-------------------- | :----------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Muhammad Dhafin Alfeizar Gandhang | **Contract Owner**    | 24/539735/PA/22916 | Lemielll        | Pemegang tanggung jawab atas `openapi.yaml` . Setiap perubahan antarmuka ditinjau oleh peran ini, terlepas dari siapa penulisnya. |
| Hafidz Kurniawan Nahruntoko       | **Service Owner**     | 24/539859/PA/22920 | DaisyDazy       | Backend yang di-deploy, konfigurasi, migrasi, dan health endpoint-nya.                                                            |
| Arnoldus Dharma Wasesa Mahasmara  | **Client Owner**      | 24/545535/PA/23182 | Arnold-XV       | Klien yang dihadapi pengguna, serta pelaporan tertulis atas setiap ambiguitas yang ditemukan dalam kontrak.                       |
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

Contoh `curl` (ganti host/port jika berbeda):

1) Skenario sukses — POST dengan `Idempotency-Key`:

```bash
curl -i -X POST "http://localhost:4010/v1/lease-payments" \
	-H "Content-Type: application/json" \
	-H "Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000" \
	-d '{"leaseId":"L-123","amount":1000000,"currency":"IDR"}'
```

2) Skenario error — header `Idempotency-Key` tidak disertakan (harus mengembalikan Problem Details):

```bash
curl -i -X POST "http://localhost:4010/v1/lease-payments" \
	-H "Content-Type: application/json" \
	-d '{"leaseId":"L-124","amount":500000,"currency":"IDR"}'
```

3) Skenario conflict (409) — ulangi request dengan `Idempotency-Key` sama untuk memicu respons konflik/duplicate:

```bash
curl -i -X POST "http://localhost:4010/v1/lease-payments" \
	-H "Content-Type: application/json" \
	-H "Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000" \
	-d '{"leaseId":"L-123","amount":1000000,"currency":"IDR"}'
```

Catatan:
- Endpoint dan body mengikuti skema di `openapi.yaml`; sesuaikan field bila diperlukan.
- Ekspektasi status code dan body error mengikuti format RFC 9457 (Problem Details).

---

Referensi struktur contract tests: lihat `tests/contract/`.

