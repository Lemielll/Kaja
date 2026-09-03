## Dekomposisi Aturan Bisnis

* **Aturan Bisnis Terpilih:** "Jadwal peminjaman alat berat tidak boleh dikonfirmasi atau disetujui jika tanggal sewa bertabrakan dengan peminjaman aktif lain pada unit alat yang sama."

| Lapisan Sistem | Peran terhadap Aturan | Implementasi pada Sistem |
| :--- | :--- | :--- |
| **Service** | Menegakkan aturan. Merupakan satu-satunya lapisan tempat aturan tersebut berlaku secara otoritatif. | Backend melakukan pengecekan bentrok rentang tanggal pada database secara transaksional saat permintaan sewa masuk. |
| **Kontrak** | Menyatakan aturan: transisi yang diizinkan, status code yang dikembalikan saat aturan dilanggar, dan field yang memungkinkan klien memprediksi hasil. | Menetapkan respons penolakan dengan kode status `409 Conflict` (Format Problem Details) beserta *extension members* daftar tanggal bentrok yang tersedia. |
| **Klien** | Memprediksi aturan, misalnya dengan menyembunyikan kontrol tertentu. Bersifat peningkatan pengalaman pengguna, bukan mekanisme kendali. | Aplikasi klien menonaktifkan tombol "Konfirmasi Sewa" atau menampilkan kalender ketersediaan alat yang mengaburkan tanggal-tanggal terblokir untuk mencegah pengguna salah input. |
