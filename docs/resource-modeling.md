# Resource Modeling (B.1)

Kandidat diturunkan dari paragraf domain pada keputusan domain: alat berat, permohonan/kontrak sewa, inspeksi, proses checkout, hasil validasi, dan gabungan rental dengan inspeksi.

| Kandidat | Keputusan | Alasan |
| --- | --- | --- |
| `Equipment` | Diterima sebagai resource | Memiliki ID opaque (`eqp_…`), tetap ada di inventaris lintas request, dan status ketersediaannya dapat berubah tanpa membuat ulang rental. |
| `Rental` | Diterima sebagai resource | Memiliki ID opaque (`rnt_…`), hidup dari pengajuan sampai selesai/dibatalkan, serta memiliki jadwal dan status sendiri. |
| `Inspection` | Diterima sebagai resource | Memiliki ID opaque (`ins_…`), tetap ada sebagai catatan audit, dan status/catatan inspeksinya dapat berubah secara mandiri walaupun terhubung ke satu rental. |
| `CheckoutProcess` | Ditolak | Tidak memiliki identifier atau URI stabil dan hanya merupakan rangkaian interaksi sementara sebelum rental dibuat. |
| `ValidationResult` | Ditolak | Hanya hasil kalkulasi dari satu request; tidak memiliki masa hidup lintas request ataupun lifecycle mandiri. |
| `RentalWithInspections` | Ditolak | Bukan entitas domain mandiri, melainkan komposisi tampilan. Menjadikannya resource akan menggabungkan lifecycle berbeda dan menyulitkan pagination maupun pengiriman inspeksi offline. |

Endpoint diturunkan dari resource tersebut, bukan dari layar UI: koleksi tersedia di `/equipments` dan `/rentals`, sedangkan inspeksi menjadi sub-resource satu tingkat di `/rentals/{id}/inspections`.
