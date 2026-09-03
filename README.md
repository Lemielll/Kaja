# Anggota Kelompok & Peran (Pertemuan 2)

| Nama Anggota                      | Peran                 | NIM                | Username Github | Tanggung Jawab                                                                                                                    |
| :-------------------------------- | :-------------------- | :----------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| Muhammad Dhafin Alfeizar Gandhang | **Contract Owner**    | 24/539735/PA/22916 | Lemielll        | Pemegang tanggung jawab atas `openapi.yaml` . Setiap perubahan antarmuka ditinjau oleh peran ini, terlepas dari siapa penulisnya. |
| Hafidz Kurniawan Nahruntoko       | **Service Owner**     | 24/539859/PA/22920 | DaisyDazy       | Backend yang di-deploy, konfigurasi, migrasi, dan health endpoint-nya.                                                            |
| Arnoldus Dharma Wasesa Mahasmara  | **Client Owner**      | 24/545535/PA/23182 | Arnold-XV       | Klien yang dihadapi pengguna, serta pelaporan tertulis atas setiap ambiguitas yang ditemukan dalam kontrak.                       |
| Ajie Armansyah Sunaryo                    | **Integration Owner** | 24/545286/PA/23170            | AjieArmansyahSunaryo        | Mock server, contract test, dan koordinasi dengan kelompok mitra pada Pertemuan 7.                                                |

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