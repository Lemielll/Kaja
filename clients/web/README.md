# Kaja Web Client

## Menjalankan lokal

Prasyarat: Node.js dan npm. Dari folder ini:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Vite berjalan di `http://localhost:3000`, sesuai redirect URI `web-app` pada
konfigurasi Keycloak. Atur `VITE_API_BASE_URL`, `VITE_OIDC_ISSUER`, dan
`VITE_OIDC_CLIENT_ID` dalam `.env` bila lingkungan berbeda. Nilai `VITE_*`
bukan secret dan dibundel ke browser.

## Workflow routes

- `/rentals` - daftar rental kontraktor/gudang.
- `/equipments` - katalog equipment kontraktor.
- `/rentals/new` - mengajukan rental untuk unit terpilih.
- `/rentals/:id` - detail rental.
- `/inspection` - memasukkan ID rental yang telah ditugaskan.
- `/rentals/:id/inspection` - inspeksi rental oleh operator lapangan.

Semua request jaringan harus melewati `src/lib/api.ts`; jangan memanggil
`fetch` dari komponen.

## Penyimpanan sesi

Web menggunakan Authorization Code + PKCE (S256) sebagai public client.
Access token dan objek sesi disimpan di memory saja; token tidak ditulis ke
`localStorage`. OIDC transaction state/PKCE disimpan sementara oleh
`oidc-client-ts` di `sessionStorage` untuk melewati redirect callback. Aplikasi
tidak menyimpan refresh token persisten atau melakukan silent refresh; jika API
mengembalikan 401, sesi memory dibuang dan pengguna diminta masuk ulang. Ini
belum memenuhi desain refresh token melalui cookie `HttpOnly`; arsitektur BFF
atau keputusan keamanan tim masih diperlukan. Tombol keluar mengakhiri sesi
Keycloak melalui RP-Initiated Logout yang diumumkan discovery OIDC dan
menghapus sesi lokal. Access token JWT yang telah terbit tetap dapat berlaku
sampai kedaluwarsa.

## Status integrasi

API production: `https://kaja-service-0cns.onrender.com/v1`.
Pada 2026-09-30 preflight dan health request dari `http://localhost:3000`
berhasil dengan header CORS yang diperlukan. Origin static web production
belum diizinkan dan perlu ditambahkan ke `CORS_ALLOWED_ORIGINS`. Login
production belum diverifikasi karena OIDC discovery timeout.

## Deploy ke Render

Blueprint root `render.yaml` menyiapkan static site `kaja-web`. Setelah
Blueprint dijalankan dan Render memberi URL aktual:

1. Daftarkan `<WEB_URL>/callback` dan `<WEB_URL>/sign-in` sebagai redirect URI
	`web-app` di Keycloak, serta `<WEB_URL>` sebagai web origin.
2. Berikan origin yang sama ke Service Owner untuk allowlist CORS API.
3. Pastikan build environment memakai production `VITE_API_BASE_URL` dan
	`VITE_OIDC_ISSUER`, lalu jalankan deploy.
4. Uji login, API request, dan reload route langsung dari perangkat lain.

Jangan tandai deployment end-to-end selesai sampai CORS dan login production
berhasil diuji dari URL Render tersebut.