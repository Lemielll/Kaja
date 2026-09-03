
This folder contains the initial structure for contract testing and coordination with partner teams.

What to include here:
- `examples/` — contoh request dan response yang digunakan oleh pengujian otomatis.
- `scripts/` — skrip pembantu untuk menjalankan smoke check terhadap mock server.
- `README.md` — (file ini) menjelaskan cara menjalankan pemeriksaan dasar.

Quick start (manual checks):

1. Jalankan mock server Prism dari root repositori:

```bash
npx @stoplight/prism-cli mock openapi.yaml
```

2. Gunakan contoh curl yang ada di `README.md` repositori untuk menguji endpoint.

3. Tambahkan Partner-facing tests di sini (misalnya, Postman collections, Pact contracts, atau simple shell scripts).

Ganti file ini dengan instruksi pengujian yang lebih mendetail seiring dengan berkembangnya contract tests.
