# Compatibility Policy (B.5)

Dokumen API ini mengikuti prinsip kompatibilitas yang aman untuk evolusi kontrak layanan antar sistem. Seluruh perubahan yang bersifat aditif diperbolehkan selama tidak mengubah arti semantik field yang sudah ada. Setiap tambahan field baru harus bersifat opsional dan tidak membahayakan client lama.

## Prinsip utama

- Field yang sudah ada tidak boleh dihapus atau diubah jenisnya tanpa versi major baru.
- Nilai uang selalu direpresentasikan dalam bilangan integer minor unit, bukan float.
- Client wajib mengabaikan field response yang tidak dikenal agar perubahan aditif aman.
- Enum status ditutup dan client harus memperlakukan nilai yang tidak dikenali sebagai `in_progress` tanpa crash.
- Semua perubahan yang memengaruhi request payload dari bentuk yang valid ke bentuk yang tidak valid harus didokumentasikan dan dirilis dalam versi major yang jelas.

## Dampak pada pengembangan

- Penambahan endpoint baru atau field opsional diperbolehkan untuk menjaga interoperabilitas.
- Perubahan yang menambah nilai enum baru pada status masih dapat dikategorikan aditif jika client memperlakukan nilai asing secara aman.
- Konflik business rule seperti jadwal bentrok atau reuse idempotency harus ditangani melalui error code `409` dari problem details.
- Endpoint atau field yang dipensiunkan wajib ditandai dengan header `Deprecation: true` dan `Sunset: <RFC 3339 date>` serta disertai panduan migrasi.

## Kriteria penerimaan

Semua perubahan kontrak harus memenuhi:

1. Tidak merusak consumer lama.
2. Memiliki contoh request/response yang diperbarui.
3. Dideskripsikan dalam changelog atau dokumentasi versi.
4. Tidak mengubah definisi `Problem` tanpa mempertahankan kompatibilitas RFC 9457.

## Penanganan Field Tidak Dikenal

Client wajib mengabaikan field response tambahan yang tidak dikenali. Validasi ketat boleh digunakan saat pengembangan, tetapi tidak boleh membuat client gagal saat menerima perubahan aditif.
