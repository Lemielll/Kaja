# Pemodelan Resource Domain Penyewaan Alat Berat

## Tabel Ekstraksi dan Pengujian Kandidat Resource

| Kandidat Kata Benda | Kriteria Identitas                    | Kriteria Masa Hidup                    | Kriteria Kemandirian                                                                | Keputusan    | Alasan                                                                       |
| :------------------ | :------------------------------------ | :------------------------------------- | :---------------------------------------------------------------------------------- | :----------- | :--------------------------------------------------------------------------- |
| `LeaseRequest`      | Memiliki UUID unik (misal `req_8F2a`) | Ada setelah request selesai            | Dapat berubah status (pending, approved, rejected) tanpa membuat ulang entitas lain | **DITERIMA** | Memenuhi ketiga kriteria resource domain.                                    |
| `LeasePayment`      | Memiliki UUID unik (misal `pay_01Xz`) | Tersimpan permanen untuk riwayat audit | Berdiri sendiri dan terikat pada `requestId`                                        | **DITERIMA** | Memenuhi ketiga kriteria resource domain.                                    |
| `Equipment`         | Memiliki serial number / ID alat      | Tetap ada di inventaris lintas request | Status ketersediaannya berubah secara mandiri                                       | **DITERIMA** | Memenuhi ketiga kriteria resource domain.                                    |
| `CheckoutProcess`   | Tidak memiliki URI/ID yang stabil     | Hilang setelah alur pengajuan selesai  | Ketergantungan penuh pada proses instan                                             | **DITOLAK**  | Tidak memiliki identitas yang dapat ditunjuk dan masa hidup yang independen. |
| `ValidationResult`  | Tidak ada identifier unik             | Hanya ada sesaat saat eksekusi request | Tidak dapat berubah state secara mandiri                                            | **DITOLAK**  | Merupakan hasil transient dari kalkulasi server, bukan resource domain.      |
