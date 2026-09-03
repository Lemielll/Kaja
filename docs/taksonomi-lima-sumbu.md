# Taksonomi Lima Sumbu Klien

| Klien | Kemampuan menyimpan rahasia | Ketersediaan jaringan | Anggaran latensi | Batas sumber daya | Kehadiran manusia |
| --- | --- | --- | --- | --- | --- |
| Web admin gudang | Dapat menyimpan kredensial server-side di luar kendali pengguna akhir. | Umumnya selalu tersedia pada jaringan gudang. | Persetujuan jadwal perlu terlihat dalam ≤2 detik agar antrean administrasi tidak tersendat. | Browser desktop dan jaringan kantor relatif longgar. | Admin membaca alasan konflik jadwal dan mengambil keputusan persetujuan. |
| Mobile kontraktor | Token sesi disimpan dalam secure storage perangkat, tetapi perangkat tetap dikuasai pengguna. | Intermiten saat kontraktor berada di proyek atau perjalanan. | Ketersediaan alat perlu tampil dalam ≤500 ms saat mencari jadwal. | Baterai, kuota seluler, dan penyimpanan perangkat terbatas. | Kontraktor menilai biaya deposit dan pesan penolakan sebelum mengubah permohonan. |
| Mobile operator lapangan | Token sesi disimpan dalam secure storage, tetapi perangkat dapat berada di bawah kendali operator. | Sering tidak tersedia di lokasi konstruksi terpencil. | Pencatatan inspeksi harus dapat disimpan segera tanpa menunggu jaringan. | Perangkat memiliki baterai, memori, dan bandwidth seluler yang terbatas. | Operator membaca temuan inspeksi yang ambigu dan menuliskan catatan sebelum mengirimkannya. |

- Karena jaringan web admin gudang umumnya tersedia, klien ini dapat meminta status terbaru sebelum memutuskan persetujuan; operasi mutasi tetap memakai kontrak yang sama.
- Karena jaringan aplikasi kontraktor intermiten, klien ini menyimpan permohonan rental yang tertunda beserta `Idempotency-Key` sampai respons berhasil diterima.
- Karena jaringan aplikasi operator lapangan sering tidak tersedia, klien ini memerlukan durable mutation queue untuk inspeksi, dan operasi unsafe memakai `Idempotency-Key` yang sama saat retry.
