# Temuan Ambiguitas dan Lubang Kontrak API

## Tujuan

Dokumen ini mencatat ambiguitas dan kekurangan pada `openapi.yaml` yang dapat menghambat implementasi frontend Web dan Mobile untuk sistem penyewaan alat berat.

Audit ini membandingkan kontrak API dengan alur domain yang terdokumentasi: kontraktor mengajukan sewa, admin gudang memverifikasi dan menyetujui pengeluaran alat, serta operator lapangan menerima dan menginspeksi alat melalui perangkat mobile dengan konektivitas yang tidak selalu stabil.

## Status Validasi

`openapi.yaml` telah lulus validasi formal menggunakan:

```text
npx redocly lint openapi.yaml
```

Dengan demikian, temuan dalam dokumen ini terutama berkaitan dengan kelengkapan kebutuhan frontend, konsistensi antar-dokumen, dan kejelasan perilaku bisnis, bukan kesalahan sintaks YAML atau struktur dasar OpenAPI.

## Ringkasan Prioritas

| Prioritas | Temuan | Dampak utama |
| --- | --- | --- |
| P0 | Tidak ada autentikasi, role, dan tenant context | Data dan identitas pengguna tidak dapat diamankan atau ditentukan secara kontraktual |
| P0 | Status pembayaran deposit tidak dimodelkan | Frontend tidak dapat menampilkan atau mengendalikan alur pembayaran |
| Selesai | `Idempotency-Key` inspeksi tidak ada di OpenAPI | Header wajib, retensi, dan perilaku retry kini disepakati dalam kontrak |
| P1 | Tidak ada URL foto atau metadata visual alat | Mobile tidak dapat menampilkan katalog alat secara layak |
| P1 | Tidak ada API ketersediaan berdasarkan rentang waktu | Kalender booking tidak dapat memprediksi konflik jadwal |
| P1 | Tidak ada endpoint untuk membaca riwayat inspeksi | Frontend tidak dapat menampilkan hasil atau status sinkronisasi inspeksi |
| P1 | Status dan transisi rental ambigu | Label, tombol aksi, dan navigasi workflow dapat berbeda antar-client |
| P1 | Aturan waktu sewa belum jelas | Perhitungan bentrok jadwal dapat berbeda antara client dan server |
| P2 | Data harga dan biaya belum lengkap | Frontend tidak dapat menampilkan total biaya yang otoritatif |
| P2 | Pagination dan sorting belum didefinisikan | Daftar besar sulit ditampilkan secara efisien |
| Selesai | Kode error stabil belum tersedia | URI `Problem.type` kini stabil dan memiliki contoh konkret per respons error |
| P2 | Response error umum belum lengkap | Perilaku client untuk autentikasi, rate limit, dan gangguan server tidak jelas |

## Temuan Detail

### 1. Equipment tidak memiliki foto atau metadata katalog

`GET /equipments` mengembalikan schema `Equipment`, tetapi schema tersebut hanya memiliki identitas, tipe, status, tarif, mata uang, lokasi, dan timestamp.

Tidak tersedia field seperti:

- `name` atau nama komersial alat;
- `manufacturer`;
- `model`;
- `serialNumber`;
- `imageUrl` atau daftar foto;
- spesifikasi penting seperti kapasitas, daya, atau tahun produksi.

**Dampak ke frontend:** aplikasi mobile tidak memiliki sumber URL untuk menampilkan foto alat. UI katalog juga hanya dapat menampilkan tipe generik seperti `excavator`, bukan identitas alat yang mudah dibedakan.

**Rekomendasi:** tambahkan minimal `name` dan `imageUrl`. Jika satu alat dapat memiliki beberapa foto, gunakan array objek media yang memuat URL, tipe media, dan urutan tampilan.

Contoh minimal:

```yaml
name:
  type: string
imageUrl:
  type: string
  format: uri
```

### 2. Ketersediaan belum dapat dicari berdasarkan rentang waktu

`GET /equipments` hanya mendukung filter `status` dan `type`. Status `available` menggambarkan keadaan saat ini, bukan ketersediaan alat pada jadwal yang sedang dipilih pengguna.

**Dampak ke frontend:** kalender booking tidak dapat mengaburkan tanggal yang sudah terisi sebelum pengguna mengirim request. Client harus mencoba membuat rental terlebih dahulu dan menunggu `409 Conflict`.

**Rekomendasi:** tambahkan `startTime` dan `endTime` sebagai parameter pencarian, atau sediakan endpoint availability yang mengembalikan slot tersedia dan rentang waktu yang bentrok.

### 3. Pembayaran deposit belum dimodelkan

Deskripsi domain dan `POST /rentals` menyebut pembayaran atau review deposit, tetapi schema `Rental` hanya memiliki `depositAmount` dan `currency`.

Tidak ada representasi untuk:

- status pembayaran, misalnya `pending`, `paid`, `failed`, atau `refunded`;
- payment ID atau payment reference;
- waktu pembayaran;
- waktu verifikasi admin;
- status pengembalian deposit;
- detail instruksi atau URL pembayaran;
- endpoint pembayaran atau verifikasi pembayaran.

**Dampak ke frontend:** frontend tidak dapat menampilkan status pembayaran yang akurat dan tidak dapat membedakan rental yang menunggu pembayaran dari rental yang sudah diverifikasi.

**Rekomendasi:** tetapkan apakah pembayaran merupakan resource tersendiri atau bagian dari `Rental`, lalu sediakan status dan endpoint yang dapat dibaca client.

### 4. Identitas pengguna, role, dan tenant context belum didefinisikan

Spesifikasi menggunakan `security: []`, sementara `GET /rentals` menyatakan data dikembalikan untuk active tenant context. Tidak ada skema autentikasi, header tenant, atau endpoint identitas pengguna.

Selain itu, `contractorId` dan `warehouseAdminId` dikirim oleh client pada saat membuat rental.

**Dampak ke frontend dan keamanan:**

- frontend tidak tahu bagaimana mengirim token atau menentukan sesi aktif;
- client berpotensi mengirim identitas kontraktor atau admin lain;
- aturan akses antara kontraktor, admin gudang, dan operator tidak dapat diterapkan secara konsisten;
- sumber `active tenant context` tidak jelas.

**Rekomendasi:** definisikan security scheme, mekanisme tenant context, serta sumber identitas aktor. Identitas pengguna yang sedang login sebaiknya diambil dari token, bukan dipercaya dari body request.

### 5. `Idempotency-Key` inspeksi — selesai

`POST /rentals/{id}/inspections` kini mewajibkan header `Idempotency-Key` di `openapi.yaml`, selaras dengan [pernyataan idempotency](idempotency.md). Key memakai UUID v4, disimpan selama 24 jam, dan dipakai ulang dengan body yang sama ketika mobile melakukan retry setelah koneksi pulih. Kontrak juga menyatakan respons `409` untuk key yang dipakai pada body berbeda dan request asal yang masih diproses.

### 6. Tidak ada endpoint untuk membaca riwayat inspeksi

Kontrak hanya menyediakan `POST /rentals/{id}/inspections`.

**Dampak ke frontend:** aplikasi tidak dapat:

- menampilkan inspeksi sebelumnya;
- memeriksa apakah antrean inspeksi offline sudah tersinkron;
- menampilkan inspeksi saat serah-terima atau pengembalian alat;
- menghindari pengisian data yang sudah pernah dikirim.

**Rekomendasi:** tambahkan `GET /rentals/{id}/inspections`, dengan dukungan sorting berdasarkan `inspectedAt` dan pagination bila diperlukan.

### 7. Jenis inspeksi belum dibedakan

Deskripsi endpoint menyebut inspeksi untuk equipment yang diterima atau dikembalikan, tetapi request dan response tidak memiliki field yang membedakan tahap inspeksi tersebut.

**Dampak ke frontend:** client tidak dapat menentukan apakah record merupakan inspeksi `pickup`, `return`, atau jenis pemeriksaan lain.

**Rekomendasi:** tambahkan field seperti `inspectionType` atau `stage`, dengan enum yang didefinisikan secara eksplisit.

### 8. Data bukti inspeksi lapangan belum tersedia

Model `Inspection` hanya memiliki status, waktu, catatan, dan ringkasan kerusakan. Belum ada field untuk kebutuhan umum inspeksi mobile, seperti:

- foto kerusakan atau foto kondisi alat;
- checklist komponen;
- koordinat lokasi;
- pembacaan hour meter;
- tanda tangan operator atau pihak penerima;
- waktu perangkat dan waktu server;
- status sinkronisasi atau client mutation ID.

**Dampak ke frontend:** aplikasi mobile mungkin harus menyimpan data lokal yang tidak memiliki padanan di API, atau mengirimnya melalui mekanisme yang tidak tercakup kontrak.

**Rekomendasi:** sepakati scope inspeksi minimal dan modelkan data bukti yang benar-benar diperlukan. Untuk upload media, tentukan apakah API menerima URL yang sudah diunggah atau menyediakan endpoint upload.

### 9. Arti status rental dan transisinya ambigu

Rental memiliki status `draft`, `approved`, `in_progress`, `active`, `completed`, `cancelled`, dan `rejected`, tetapi tidak ada definisi kapan setiap status digunakan atau transisi mana yang sah.

`in_progress` dan `active` khususnya dapat ditafsirkan sama oleh frontend.

**Dampak ke frontend:** tombol seperti approve, cancel, start, complete, atau submit inspection dapat muncul secara berbeda antar-client. Client juga tidak tahu status berikutnya yang diharapkan.

**Rekomendasi:** dokumentasikan state transition dan aksi yang tersedia pada setiap status. Pertimbangkan endpoint command/action jika transisi bukan operasi update biasa.

### 10. Aturan waktu dan konflik jadwal belum cukup tegas

Request menggunakan `startTime` dan `endTime` bertipe date-time, sedangkan error konflik mengembalikan `unavailableDates` bertipe date.

Belum jelas:

- apakah `endTime` inklusif atau eksklusif;
- bagaimana konflik pada jam yang sama dihitung;
- timezone mana yang menjadi acuan;
- apakah jam operasional gudang memengaruhi validasi;
- apakah error tanggal cukup untuk konflik yang sebenarnya berbasis waktu.

**Dampak ke frontend:** kalender dan validasi lokal dapat menghasilkan keputusan berbeda dari backend.

**Rekomendasi:** tetapkan aturan interval, timezone kanonis, jam operasional, dan format detail konflik. Bila aturan berbasis waktu, pertimbangkan mengembalikan conflicting intervals selain tanggal.

### 11. Harga total rental belum tersedia

`Equipment` memiliki `hourlyRate`, sedangkan `Rental` hanya menyimpan deposit. Tidak ada total biaya sewa, jumlah jam yang ditagihkan, biaya tambahan, pajak, diskon, atau breakdown harga.

**Dampak ke frontend:** client harus menghitung harga sendiri. Hasil tersebut dapat berbeda dari perhitungan backend, terutama untuk pembulatan, jam operasional, biaya transportasi, atau pajak.

**Rekomendasi:** kembalikan nilai harga yang sudah dihitung server, minimal `totalAmount` dan breakdown biaya, dengan mata uang yang jelas.

### 12. List response tidak memiliki pagination atau sorting

`GET /equipments` dan `GET /rentals` mengembalikan array langsung tanpa parameter pagination, sorting, atau metadata total.

**Dampak ke frontend:** daftar besar dapat memperlambat mobile dan web. Client juga tidak memiliki cara kontraktual untuk meminta halaman berikutnya atau menentukan urutan data.

**Rekomendasi:** definisikan pagination berbasis cursor atau page/limit, sorting, dan metadata seperti `nextCursor` atau `total`.

### 13. Unknown enum value bertentangan dengan enum tertutup

Beberapa status memiliki `enum` tertutup, tetapi deskripsinya menyatakan client harus memperlakukan nilai yang tidak dikenal sebagai `in_progress` dan tidak boleh crash.

**Dampak ke frontend:** generator client atau validator dapat menolak nilai baru sebelum logika fallback client berjalan. Ini menyulitkan evolusi status secara backward-compatible.

**Rekomendasi:** pertahankan fallback dalam panduan client, tetapi definisikan strategi evolusi enum dengan jelas. Pertimbangkan schema yang tidak terlalu membatasi response bila kompatibilitas nilai baru memang diwajibkan.

### 14. Kode error stabil — selesai

Setiap kelas error yang dideklarasikan memakai URI `Problem.type` yang stabil, misalnya `https://api.heavyrental.co/problems/idempotency-key-reuse`. Contoh payload konkret tersedia pada reusable responses di `openapi.yaml`, dan daftar tindakan klien tersedia pada [katalog error](error-catalog.md). Client dapat melakukan percabangan berdasarkan `type`, bukan teks `detail`.

### 15. Response error umum belum lengkap

Endpoint belum mendefinisikan response untuk kondisi seperti:

- `401 Unauthorized`;
- `403 Forbidden`;
- `429 Too Many Requests`;
- `500 Internal Server Error`;
- `503 Service Unavailable`.

**Dampak ke frontend:** perilaku refresh token, pesan akses ditolak, retry dengan backoff, dan mode offline tidak memiliki kontrak yang jelas.

**Rekomendasi:** tambahkan response umum yang relevan dan gunakan schema Problem Details secara konsisten.

### 16. Contoh penggunaan di README — selesai

Semua contoh cURL pada README dan panduan mock kini menggunakan path koleksi yang sama dengan path OpenAPI. Prefix `/v1` sudah berasal dari URL server OpenAPI dan otomatis ditangani Prism pada URL mock. Contoh endpoint lama `lease-payments` tidak digunakan dalam kontrak atau dokumentasi aktif.

## Keputusan yang Perlu Disepakati

Sebelum frontend dan backend dikembangkan lebih jauh, tim perlu menyepakati minimal hal berikut:

1. Field katalog equipment yang wajib ditampilkan, termasuk foto.
2. Mekanisme autentikasi, role, dan tenant context.
3. Apakah pembayaran deposit merupakan resource tersendiri.
4. Endpoint availability dan aturan konflik waktu.
5. Idempotency untuk seluruh operasi unsafe, termasuk inspeksi.
6. Endpoint pembacaan riwayat inspeksi dan jenis inspeksi.
7. State transition rental yang resmi.
8. Format kode error yang stabil.
9. Strategi pagination untuk collection.
10. Keselarasan README, mock server, dan OpenAPI.

## Kesimpulan

Kontrak saat ini sudah cukup untuk membuat prototype sederhana berupa daftar alat, pembuatan rental, pembacaan rental berdasarkan ID, dan pengiriman inspeksi. Namun kontrak belum cukup untuk mendukung frontend produksi secara konsisten, terutama pada katalog visual, pembayaran, autentikasi, availability scheduling, workflow status, dan sinkronisasi offline.

Temuan paling langsung menjawab kebutuhan mobile adalah tidak adanya `imageUrl` pada `Equipment`. Perbaikan berikutnya yang paling berisiko adalah autentikasi/tenant context, model pembayaran deposit, dan idempotency pada inspeksi offline.
