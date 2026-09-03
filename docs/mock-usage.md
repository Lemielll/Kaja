# Mock Server dan Contoh cURL

## Menjalankan mock server

```bash
npx @stoplight/prism-cli mock openapi.yaml
```

## Contoh request GET

```bash
curl -i http://127.0.0.1:4010/equipments
```

## Contoh request POST dengan Idempotency-Key

```bash
curl -i -X POST http://127.0.0.1:4010/rentals \
  -H 'Idempotency-Key: 0f7c1b9e-3d21-4a6f-9c05-8e2b7d41a9f0' \
  -H 'Content-Type: application/json' \
  -d '{
    "equipmentId": "eqp_8X2kAB",
    "contractorId": "ctr_72Xp9C",
    "warehouseAdminId": "adm_19Lq2f",
    "startTime": "2026-09-15T08:00:00Z",
    "endTime": "2026-09-18T17:00:00Z",
    "depositAmount": 150000,
    "currency": "USD"
  }'
```

## Contoh request POST tanpa header Idempotency-Key

```bash
curl -i -X POST http://127.0.0.1:4010/rentals \
  -H 'Content-Type: application/json' \
  -d '{
    "equipmentId": "eqp_8X2kAB",
    "contractorId": "ctr_72Xp9C",
    "warehouseAdminId": "adm_19Lq2f",
    "startTime": "2026-09-15T08:00:00Z",
    "endTime": "2026-09-18T17:00:00Z",
    "depositAmount": 150000,
    "currency": "USD"
  }'
```

Mock server Prism akan menolak request tanpa `Idempotency-Key` sesuai dengan spesifikasi yang dideklarasikan.
