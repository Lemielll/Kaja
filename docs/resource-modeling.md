# Resource Modeling (B.1)

Dokumen ini menjadi sumber utama pemodelan resource untuk kontrak API aktual.

| Resource | Identitas | Masa hidup | Kemandirian | Status |
| --- | --- | --- | --- | --- |
| `Equipment` | ID opaque, mis. `eqp_8X2kAB` | Persisten di inventaris | Status ketersediaan berubah mandiri | Diterima |
| `Rental` | ID opaque, mis. `rnt_3MnB7xP` | Dari pengajuan hingga selesai/dibatalkan | Memiliki lifecycle dan jadwal sendiri | Diterima |
| `Inspection` | ID opaque, mis. `ins_9Hk2pQ` | Persisten sebagai catatan inspeksi | Terikat pada rental tetapi memiliki status dan waktu sendiri | Diterima |

## Contoh Resource

```json
{
	"id": "rnt_3MnB7xP",
	"equipmentId": "eqp_8X2kAB",
	"contractorId": "ctr_72Xp9C",
	"warehouseAdminId": "adm_19Lq2f",
	"status": "approved",
	"startTime": "2026-09-15T08:00:00Z",
	"endTime": "2026-09-18T17:00:00Z",
	"depositAmount": 150000,
	"currency": "USD"
}
```

## Kandidat yang Ditolak

1. `CheckoutProcess`: tidak memiliki URI/ID stabil dan hanya merupakan alur sementara, bukan resource yang dapat dirujuk.
2. `ValidationResult`: hanya hasil kalkulasi sementara dari request dan tidak memiliki lifecycle mandiri.
3. Menggabungkan `Rental` dan `Inspection` menjadi `RentalWithInspections`: memperbesar payload dan menyulitkan pagination serta pemrosesan inspeksi offline.

Definisi schema lengkap, field wajib, dan contoh properti berada di `openapi.yaml`.
