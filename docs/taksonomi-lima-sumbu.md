| Sumbu | Pertanyaan | Menentukan Materi | Analisis pada Klien / Sistem Ini |
| :--- | :--- | :--- | :--- |
| **1. Kemampuan menyimpan rahasia** | Dapatkah kredensial disimpan di luar jangkauan pengguna dan pihak yang menguasai perangkat? | Pertemuan 4 (identitas) | Klien mobile kontraktor menyimpan token sesi otentikasi di dalam *secure storage* perangkat. |
| **2. Ketersediaan jaringan** | Selalu tersedia, intermiten, atau sering tidak tersedia? | Pertemuan 2 (idempotency), Pertemuan 6 (offline) | Operator lapangan di area proyek konstruksi sering menghadapi jaringan seluler yang intermiten. |
| **3. Anggaran latensi** | Berapa lama sebuah operasi boleh berlangsung sebelum tujuan klien tidak tercapai? | Pertemuan 10 (real-time) | Latensi pencarian ketersediaan alat berat dibatasi maksimal 500ms agar responsif. |
| **4. Batas sumber daya** | Memori, penyimpanan, daya, dan bandwidth. | Pertemuan 11 (IoT) | Perangkat mobile operator lapangan memiliki keterbatasan daya baterai dan bandwidth seluler area terpencil. |
| **5. Kehadiran manusia** | Apakah ada manusia yang menafsirkan respons yang ambigu? Agen otonom akan menafsirkan secara mandiri dan langsung bertindak. | Pertemuan 2 (desain error), Pertemuan 12-13 | Manusia (admin gudang dan kontraktor) membaca dan menafsirkan langsung pesan error atau penolakan sistem. |

*Karena jaringan aplikasi operator lapangan sering tidak tersedia, klien tersebut memerlukan durable mutation queue, dan operasi unsafe pada sistem ini memerlukan idempotency key.*