import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { User } from 'oidc-client-ts'
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  CheckCircle,
  ClockCountdown,
  FileText,
  FolderOpen,
  HardHat,
  MagnifyingGlass,
  PlusCircle,
  ShieldCheck,
  SignIn,
  SignOut,
  Truck,
  User as UserIcon,
  Warehouse,
  WarningCircle,
  WifiSlash,
  Wrench,
} from '@phosphor-icons/react'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/context'
import { ApiClientError, apiRequest, createIdempotencyKey, createInspection, createRental, fieldErrorsFromProblem, getEquipments, getRental, getRentals, invalidateApiResponse, type CreateInspectionInput, type CreateRentalInput, type Equipment, type Inspection, type Rental } from './lib/api'
import './App.css'

function WorkflowPage({ title, subtitle, kicker = 'Sistem Operasional Rental', children, actions }: {
  title: string
  subtitle?: string
  kicker?: string
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="workflow-page">
      {kicker && (
        <div className="page-kicker">
          <span>{kicker}</span>
        </div>
      )}
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-subheading">{subtitle}</p>}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}

type ViewState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; data: T; fetchedAt: Date }
  | { status: 'content'; data: T; fetchedAt: Date; stale: boolean; error?: string }

function rentalLoadError(error: unknown) {
  if (error instanceof ApiClientError && error.status === 403) {
    return 'Akun ini belum memiliki akses untuk melihat rental.'
  }
  if (error instanceof ApiClientError && error.status === 404) {
    return 'Data rental yang diminta tidak ditemukan.'
  }
  return 'Terjadi kendala jaringan saat mengambil data. Silakan coba beberapa saat lagi.'
}

function rentalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Menunggu',
    approved: 'Disetujui',
    in_progress: 'Berlangsung',
    active: 'Aktif',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    rejected: 'Ditolak',
  }
  return labels[status] ?? labels.in_progress
}

function formatCurrency(amount: number, currency: string = 'USD') {
  const curr = (currency || 'USD').toUpperCase()
  if (curr === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  if (curr === 'IDR') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

function localDateTime() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function RentalListPage() {
  const [state, setState] = useState<ViewState<Rental[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'in_progress' | 'completed' | 'cancelled'>('all')
  const { user } = useAuth()
  const roles = user ? roleNames(user) : []
  const canCreateRentals = roles.includes('contractor')
  const isWarehouseAdmin = roles.includes('warehouse-admin')
  const canViewCatalogue = roles.includes('contractor') || roles.includes('warehouse-admin')

  useEffect(() => {
    let active = true
    let pending = false
    let controller: AbortController | undefined

    const loadRentals = async () => {
      if (pending) return
      pending = true
      setState((current) => current.status === 'content'
        ? { ...current, stale: true, error: undefined }
        : current)
      controller = new AbortController()

      try {
        const { data } = await getRentals(controller.signal)
        if (!active) return
        const rows = data ?? []
        setState(rows.length
          ? { status: 'content', data: rows, fetchedAt: new Date(), stale: false }
          : { status: 'empty', data: rows, fetchedAt: new Date() })
      } catch (error: unknown) {
        if (!active || controller?.signal.aborted) return
        const message = rentalLoadError(error)
        setState((current) => current.status === 'content'
          ? { ...current, stale: true, error: message }
          : { status: 'error', message })
      } finally {
        pending = false
      }
    }

    void loadRentals()
    const interval = window.setInterval(() => void loadRentals(), 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
      controller?.abort()
    }
  }, [attempt])

  const refresh = () => {
    setState((current) => current.status === 'content'
      ? { ...current, stale: true, error: undefined }
      : current)
    setAttempt((current) => current + 1)
  }

  // Filter rentals based on search query and status filter
  const rentals = state.status === 'content' ? state.data : []
  const filteredRentals = rentals.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.equipmentId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Metric counts
  const totalCount = rentals.length
  const approvedCount = rentals.filter((r) => r.status === 'approved' || r.status === 'active').length
  const inProgressCount = rentals.filter((r) => r.status === 'in_progress').length
  const completedCount = rentals.filter((r) => r.status === 'completed').length

  const headerActions = canCreateRentals ? (
    <NavLink to="/equipments" className="primary-button" style={{ textDecoration: 'none' }}>
      <PlusCircle size={17} weight="bold" /> Buat Sewa Baru
    </NavLink>
  ) : canViewCatalogue ? (
    <NavLink to="/equipments" className="secondary-button" style={{ textDecoration: 'none' }}>
      <Truck size={17} weight="duotone" /> Lihat Inventaris Gudang
    </NavLink>
  ) : undefined

  return (
    <WorkflowPage
      title={isWarehouseAdmin ? "Daftar Kontrak Gudang" : "Daftar Rental Berjalan"}
      subtitle={isWarehouseAdmin ? "Kelola dan pantau seluruh kontrak sewa armada yang berada dalam lingkup gudang Anda." : "Pantau status kontrak sewa armada, jadwal durasi, dan kelaikan unit secara real-time."}
      kicker={isWarehouseAdmin ? "Admin Gudang" : "Daftar Sewa"}
      actions={headerActions}
    >
      {state.status === 'loading' && (
        <div className="skeleton-wrap" role="status">
          <div className="skeleton-row" style={{ height: '90px' }} />
          <div className="skeleton-row" style={{ height: '48px', width: '60%' }} />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <div className="error-icon-wrap">
            <WifiSlash size={28} weight="duotone" />
          </div>
          <strong>Gagal memuat data sewa</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={refresh}>
            <ArrowsClockwise size={15} /> Coba lagi
          </button>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="view-message view-message--empty">
          <div className="empty-icon-wrap">
            <FolderOpen size={28} weight="duotone" />
          </div>
          <strong>Belum ada kontrak aktif</strong>
          <p>Belum ada kontrak aktif. Buat sewa baru untuk memulai.</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center' }}>
            {canCreateRentals && (
              <NavLink to="/equipments" className="primary-button" style={{ textDecoration: 'none' }}>
                <PlusCircle size={16} weight="bold" /> Buat Sewa Baru
              </NavLink>
            )}
            <span className="sync-time-badge">
              Sinkron terakhir {state.fetchedAt.toLocaleTimeString('id-ID')}
            </span>
          </div>
        </div>
      )}

      {state.status === 'content' && (
        <>
          {/* Summary Metric Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Total Kontrak</span>
                <span className="metric-value">{totalCount}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--primary">
                <FileText size={22} weight="duotone" />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Disetujui / Siap</span>
                <span className="metric-value">{approvedCount}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--success">
                <CheckCircle size={22} weight="duotone" />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Dalam Pelaksanaan</span>
                <span className="metric-value">{inProgressCount}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--warning">
                <ClockCountdown size={22} weight="duotone" />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Selesai / Ditutup</span>
                <span className="metric-value">{completedCount}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--info">
                <ShieldCheck size={22} weight="duotone" />
              </div>
            </div>
          </div>

          {/* List Toolbar with Search, Status Chips & Sync Status */}
          <div className="list-toolbar">
            <div className="toolbar-search-wrap">
              <MagnifyingGlass size={16} className="toolbar-search-icon" />
              <input
                type="search"
                className="toolbar-search-input"
                placeholder="Cari ID rental atau unit alat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-chips">
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'all' ? 'filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                Semua ({totalCount})
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'approved' ? 'filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('approved')}
              >
                Disetujui
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'in_progress' ? 'filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('in_progress')}
              >
                Berlangsung
              </button>
              <button
                type="button"
                className={`filter-chip ${statusFilter === 'completed' ? 'filter-chip--active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                Selesai
              </button>
            </div>

            <div className="toolbar-actions">
              <span className={`sync-time-badge ${state.stale ? 'sync-time-badge--stale' : ''}`}>
                <span className="service-status__dot" style={{ background: state.stale ? '#ffa726' : '#66bb6a' }} />
                {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
              </span>
              <button className="secondary-button" type="button" onClick={refresh}>
                <ArrowsClockwise size={15} /> Muat ulang
              </button>
            </div>
          </div>

          {state.error && (
            <div className="inline-error" role="alert">
              <WarningCircle size={16} />
              <span>{state.error} Menampilkan data terakhir yang berhasil dimuat.</span>
            </div>
          )}

          {/* Soft Glass Table */}
          <div className="table-wrap">
            <table className="rental-table">
              <thead>
                <tr>
                  <th>Rental ID</th>
                  <th>Unit Alat</th>
                  {isWarehouseAdmin && <th>Penyewa</th>}
                  <th>Periode Sewa</th>
                  <th className="col-center">Status</th>
                  <th className="col-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRentals.length === 0 ? (
                  <tr>
                    <td colSpan={isWarehouseAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Tidak ada rental yang cocok dengan pencarian atau filter status.
                    </td>
                  </tr>
                ) : (
                  filteredRentals.map((rental) => (
                    <tr key={rental.id}>
                      <td>
                        <NavLink className="table-id-badge" to={`/rentals/${encodeURIComponent(rental.id)}`}>
                          <FileText size={14} weight="duotone" />
                          <span>{rental.id}</span>
                        </NavLink>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                          <Truck size={17} weight="duotone" style={{ color: 'var(--lime)' }} />
                          <span>{rental.equipmentId}</span>
                        </span>
                      </td>
                      {isWarehouseAdmin && (
                        <td>
                          <span className="table-id-badge" style={{ color: 'var(--text-secondary)' }}>
                            <UserIcon size={13} weight="duotone" />
                            <span>{rental.contractorId}</span>
                          </span>
                        </td>
                      )}
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <CalendarBlank size={14} />
                          <span>{formatDate(rental.startTime)} – {formatDate(rental.endTime)}</span>
                        </span>
                      </td>
                      <td className="col-center">
                        <span className={`status-pill status-pill--${rental.status}`}>
                          <span>{rentalStatusLabel(rental.status)}</span>
                        </span>
                      </td>
                      <td className="col-center">
                        <NavLink className="table-action-link" to={`/rentals/${encodeURIComponent(rental.id)}`}>
                          <span>Detail</span>
                        </NavLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </WorkflowPage>
  )
}

function EquipmentCataloguePage() {
  const { user } = useAuth()
  const roles = user ? roleNames(user) : []
  const isWarehouseAdmin = roles.includes('warehouse-admin')

  const [state, setState] = useState<ViewState<Equipment[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getEquipments(controller.signal)
      .then(({ data }) => {
        const items = data ?? []
        setState(items.length
          ? { status: 'content', data: items, fetchedAt: new Date(), stale: false }
          : { status: 'empty', data: items, fetchedAt: new Date() })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof ApiClientError && error.status === 403
          ? 'Akun ini belum memiliki akses ke katalog alat.'
          : 'Katalog alat gagal dimuat. Periksa koneksi lalu coba lagi.'
        setState((current) => current.status === 'content'
          ? { ...current, stale: true, error: message }
          : { status: 'error', message })
      })

    return () => controller.abort()
  }, [attempt])

  const refresh = () => {
    setState((current) => current.status === 'content'
      ? { ...current, stale: true, error: undefined }
      : current)
    setAttempt((current) => current + 1)
  }

  const headerActions = isWarehouseAdmin ? (
    <NavLink to="/rentals" className="secondary-button" style={{ textDecoration: 'none' }}>
      <FileText size={16} weight="duotone" /> Lihat Kontrak Sewa
    </NavLink>
  ) : undefined

  return (
    <WorkflowPage
      title={isWarehouseAdmin ? "Katalog & Inventaris Gudang" : "Katalog Alat Berat"}
      subtitle={isWarehouseAdmin ? "Pantau ketersediaan armada, status pemeliharaan, dan lokasi unit alat berat di gudang." : "Pilih unit armada alat berat yang tersedia untuk pengajuan kontrak sewa baru."}
      kicker={isWarehouseAdmin ? "Inventaris Gudang" : "Katalog Alat"}
      actions={headerActions}
    >
      {state.status === 'loading' && (
        <div className="skeleton-wrap" role="status">
          <div className="skeleton-row" style={{ height: '48px' }} />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <div className="error-icon-wrap">
            <WifiSlash size={28} weight="duotone" />
          </div>
          <strong>Gagal memuat katalog alat</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={() => setAttempt((count) => count + 1)}>
            <ArrowsClockwise size={15} /> Coba lagi
          </button>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="view-message view-message--empty">
          <div className="empty-icon-wrap">
            <FolderOpen size={32} weight="duotone" />
          </div>
          <strong>Belum ada armada tersedia</strong>
          <p>Seluruh unit sedang dalam masa kontrak sewa atau perawatan. Silakan periksa kembali nanti.</p>
          <span className="sync-time-badge">Sinkron terakhir {state.fetchedAt.toLocaleTimeString('id-ID')}</span>
        </div>
      )}

      {state.status === 'content' && (
        <>
          <div className="list-toolbar">
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{state.data.length} unit armada terdaftar</span>
            <div className="toolbar-actions">
              <span className={`sync-time-badge ${state.stale ? 'sync-time-badge--stale' : ''}`}>
                <span className="service-status__dot" style={{ background: state.stale ? '#ffa726' : '#66bb6a' }} />
                {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
              </span>
              <button className="secondary-button" type="button" onClick={refresh}>
                <ArrowsClockwise size={15} /> Muat ulang
              </button>
            </div>
          </div>

          {state.error && (
            <div className="inline-error" role="alert">
              <WarningCircle size={16} />
              <span>{state.error} Menampilkan data terakhir yang berhasil dimuat.</span>
            </div>
          )}

          <div className="table-wrap">
            <table className="rental-table">
              <thead>
                <tr>
                  <th>Unit ID</th>
                  <th>Kategori Mesin</th>
                  <th>Lokasi Gudang</th>
                  <th>Tarif Sewa / Jam</th>
                  <th className="col-center">Status Unit</th>
                  <th className="col-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((equipment) => (
                  <tr key={equipment.id}>
                    <td>
                      <span className="table-id-badge">
                        <Truck size={15} weight="duotone" />
                        <span>{equipment.id}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {equipment.type.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{equipment.location}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {formatCurrency(equipment.hourlyRate, equipment.currency)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>/ jam</span>
                      </span>
                    </td>
                    <td className="col-center">
                      <span className={`status-pill status-pill--${equipment.status}`}>
                        <span>{equipment.status}</span>
                      </span>
                    </td>
                    <td className="col-center">
                      {isWarehouseAdmin ? (
                        equipment.status === 'available' ? (
                          <span className="table-action-available">
                            <CheckCircle size={13} weight="bold" /> Siap Dikeluarkan
                          </span>
                        ) : equipment.status === 'maintenance' ? (
                          <span className="table-action-maintenance">
                            <ClockCountdown size={13} weight="bold" /> Dalam Perawatan
                          </span>
                        ) : (
                          <span className="table-action-reserved">
                            <FileText size={13} weight="bold" /> Sedang Tersewa
                          </span>
                        )
                      ) : equipment.status === 'available' ? (
                        <NavLink
                          className="primary-button table-action-btn"
                          to={`/rentals/new?equipmentId=${encodeURIComponent(equipment.id)}`}
                        >
                          <span>Ajukan Sewa</span>
                        </NavLink>
                      ) : equipment.status === 'maintenance' ? (
                        <button
                          className="secondary-button table-action-btn"
                          type="button"
                          disabled
                          title="Unit sedang dalam pemeliharaan berkala"
                        >
                          Dalam Perawatan
                        </button>
                      ) : (
                        <button
                          className="secondary-button table-action-btn"
                          type="button"
                          disabled
                          title="Unit sudah dipesan untuk jadwal ini"
                        >
                          Sudah Dipesan
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </WorkflowPage>
  )
}

function RentalRequestPage() {
  const [searchParams] = useSearchParams()
  const equipmentId = searchParams.get('equipmentId') || ''
  const navigate = useNavigate()
  const { user } = useAuth()
  const claims = user?.profile as Record<string, unknown> | undefined
  const warehouseAdminId = (typeof claims?.warehouseAdminId === 'string' && claims.warehouseAdminId) || 'adm_19Lq2f'
  const [form, setForm] = useState({ startTime: '', endTime: '', depositAmount: '', currency: 'USD' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [idempotencyKey] = useState(createIdempotencyKey)

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldErrors({})
    setFormError('')

    const errors: Record<string, string> = {}
    if (!equipmentId) errors.equipmentId = 'Pilih alat dari katalog sebelum melanjutkan.'
    if (!form.startTime) errors.startTime = 'Waktu mulai wajib diisi.'
    if (!form.endTime) errors.endTime = 'Waktu selesai wajib diisi.'
    if (form.startTime && form.endTime && new Date(form.startTime) >= new Date(form.endTime)) {
      errors.endTime = 'Waktu selesai harus setelah waktu mulai.'
    }
    if (!form.depositAmount || Number(form.depositAmount) < 0 || !Number.isInteger(Number(form.depositAmount))) {
      errors.depositAmount = 'Deposit harus berupa bilangan bulat nol atau lebih.'
    }
    if (!/^[A-Z]{3}$/.test(form.currency)) errors.currency = 'Masukkan kode mata uang 3 huruf kapital.'
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      return
    }

    const payload: CreateRentalInput = {
      equipmentId,
      warehouseAdminId,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      depositAmount: Number(form.depositAmount),
      currency: form.currency,
    }

    setSubmitting(true)
    try {
      const { data } = await createRental(payload, idempotencyKey)
      if (data) navigate(`/rentals/${encodeURIComponent(data.id)}`, { replace: true })
    } catch (error: unknown) {
      if (!(error instanceof ApiClientError)) {
        setFormError('Permintaan belum terkirim. Periksa koneksi lalu coba lagi; key pengiriman akan tetap sama.')
      } else if (error.status === 400) {
        setFieldErrors(fieldErrorsFromProblem(error.problem))
        setFormError(error.problem.detail || 'Periksa kembali data permintaan rental.')
      } else if (error.status === 409) {
        setFormError(error.problem.detail || 'Jadwal alat berbenturan dengan rental lain. Periksa tanggal dan coba kembali.')
      } else if (error.status === 422) {
        setFormError(error.problem.detail || 'Permintaan tidak memenuhi aturan penyewaan.')
      } else if (error.status === 403) {
        setFormError('Akun ini tidak memiliki izin untuk membuat rental.')
      } else if (error.status === 404) {
        setFormError('Alat yang dipilih tidak ditemukan.')
      } else {
        setFormError('Rental gagal dibuat. Coba lagi beberapa saat.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <WorkflowPage
      title="Pengajuan Sewa Armada"
      subtitle="Lengkapi periode operasional dan jaminan deposit untuk mengunci reservasi alat berat."
      kicker="Pengajuan Sewa"
    >
      <div className="form-panel">
        {!equipmentId ? (
          <div className="inline-error" role="alert">
            <WarningCircle size={16} />
            <span>Belum ada alat dipilih. <NavLink className="table-link" to="/equipments">Kembali ke katalog alat</NavLink></span>
          </div>
        ) : (
          <div className="equipment-selected-badge">
            <div className="equipment-selected-icon">
              <Truck size={22} weight="duotone" />
            </div>
            <div>
              <span className="equipment-selected-label">Unit Alat Berat Terpilih</span>
              <strong className="equipment-selected-id">{equipmentId}</strong>
            </div>
          </div>
        )}

        <form onSubmit={(event) => void submitRequest(event)}>
          <div className="form-group">
            <label className="form-label" htmlFor="rental-start">
              Waktu Mulai Sewa
            </label>
            <input
              id="rental-start"
              className="form-input"
              type="datetime-local"
              required
              value={form.startTime}
              onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
            />
            {fieldErrors.startTime && <span className="field-error" role="alert">{fieldErrors.startTime}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rental-end">
              Waktu Selesai Sewa
            </label>
            <input
              id="rental-end"
              className="form-input"
              type="datetime-local"
              required
              value={form.endTime}
              onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
            />
            {fieldErrors.endTime && <span className="field-error" role="alert">{fieldErrors.endTime}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rental-deposit">
              Nominal Deposit Jaminan
            </label>
            <div className="input-group">
              <span className="input-prefix">$</span>
              <input
                id="rental-deposit"
                className="form-input form-input--prefixed"
                type="number"
                min="0"
                step="1"
                required
                placeholder="150000"
                value={form.depositAmount}
                onChange={(event) => setForm((current) => ({ ...current, depositAmount: event.target.value }))}
              />
            </div>
            {fieldErrors.depositAmount && <span className="field-error" role="alert">{fieldErrors.depositAmount}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rental-currency">
              Kode Mata Uang (3 Huruf ISO)
            </label>
            <input
              id="rental-currency"
              className="form-input"
              maxLength={3}
              required
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
            />
            {fieldErrors.currency && <span className="field-error" role="alert">{fieldErrors.currency}</span>}
          </div>

          {fieldErrors.equipmentId && <span className="field-error" role="alert">{fieldErrors.equipmentId}</span>}
          {formError && <p className="inline-error" role="alert">{formError}</p>}

          <button
            className="primary-button"
            type="submit"
            style={{ width: '100%', minHeight: '44px', marginTop: '8px' }}
            disabled={submitting || !equipmentId}
          >
            <span>{submitting ? 'Mengirim Pengajuan...' : 'Kirim Permintaan Rental'}</span>
          </button>
        </form>
      </div>
    </WorkflowPage>
  )
}

function RentalDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const roles = user ? roleNames(user) : []
  const isOperator = roles.includes('field-operator')
  const isWarehouseAdmin = roles.includes('warehouse-admin')

  const [state, setState] = useState<ViewState<Rental>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void apiRequest<Rental>(`/rentals/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(({ data }) => {
        if (data) setState({ status: 'content', data, fetchedAt: new Date(), stale: false })
        else setState({ status: 'error', message: 'Rental tidak ditemukan.' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiClientError && error.status === 404) {
          setState({ status: 'error', message: 'Rental tidak ditemukan.' })
          return
        }
        if (error instanceof ApiClientError && error.status === 403) {
          setState({ status: 'error', message: 'Akun ini belum memiliki akses untuk melihat rental.' })
          return
        }
        setState((current) => current.status === 'content'
          ? { ...current, stale: true, error: 'Pembaruan rental gagal. Menampilkan data terakhir.' }
          : { status: 'error', message: 'Detail rental gagal dimuat. Periksa koneksi lalu coba lagi.' })
      })

    return () => controller.abort()
  }, [attempt, id])

  const refresh = () => {
    setState((current) => current.status === 'content'
      ? { ...current, stale: true, error: undefined }
      : current)
    setAttempt((current) => current + 1)
  }

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <NavLink
        to={isOperator ? '/inspection' : '/rentals'}
        className="secondary-button"
        style={{ textDecoration: 'none' }}
      >
        <ArrowLeft size={15} /> {isOperator ? 'Antrean Tugas' : 'Kembali ke Daftar'}
      </NavLink>
      {isWarehouseAdmin && (
        <NavLink to="/equipments" className="secondary-button" style={{ textDecoration: 'none' }}>
          <Truck size={16} weight="duotone" /> Cek di Inventaris
        </NavLink>
      )}
    </div>
  )

  const diffDays = state.status === 'content' && state.data.startTime && state.data.endTime
    ? Math.max(1, Math.round((new Date(state.data.endTime).getTime() - new Date(state.data.startTime).getTime()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <WorkflowPage
      title={`Detail Kontrak: ${id}`}
      subtitle="Rincian informasi kontrak operasional, jadwal, dan status penugasan alat."
      kicker={isOperator ? "Pemeriksaan Lapangan / Detail Penugasan" : isWarehouseAdmin ? "Admin Gudang / Detail Kontrak" : "Detail Sewa"}
      actions={headerActions}
    >
      {state.status === 'loading' && (
        <div className="skeleton-wrap" role="status">
          <div className="skeleton-row" style={{ height: '140px' }} />
          <div className="skeleton-row" style={{ height: '60px' }} />
        </div>
      )}

      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <div className="error-icon-wrap">
            <WifiSlash size={28} weight="duotone" />
          </div>
          <strong>Gagal memuat detail sewa</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={refresh}>
            <ArrowsClockwise size={15} /> Coba lagi
          </button>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="view-message view-message--empty">
          <div className="empty-icon-wrap">
            <FolderOpen size={28} weight="duotone" />
          </div>
          <strong>Rental tidak ditemukan</strong>
          <p>Identitas kontrak sewa ini tidak terdaftar dalam database operasional.</p>
        </div>
      )}

      {state.status === 'content' && (
        <>
          {isOperator && (
            <div className="inspection-callout-banner">
              <div className="inspection-callout-left">
                <div className="inspection-callout-icon">
                  <Wrench size={22} weight="duotone" />
                </div>
                <div>
                  <strong>Penugasan Audit Kelaikan Fisik</strong>
                  <p>Periksa kondisi unit mesin sebelum dan sesudah operasional di lapangan.</p>
                </div>
              </div>
              <NavLink to={`/rentals/${encodeURIComponent(id)}/inspection`} className="primary-button" style={{ textDecoration: 'none' }}>
                <span>Buka Lembar Inspeksi</span>
                <ArrowRight size={14} weight="bold" />
              </NavLink>
            </div>
          )}

          <div className="list-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`status-pill status-pill--${state.data.status}`}>
                <span>Status: {rentalStatusLabel(state.data.status)}</span>
              </span>
            </div>
            <div className="toolbar-actions">
              <span className={`sync-time-badge ${state.stale ? 'sync-time-badge--stale' : ''}`}>
                <span className="service-status__dot" style={{ background: state.stale ? 'var(--status-warning)' : 'var(--status-success)' }} />
                {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
              </span>
              <button className="secondary-button" type="button" onClick={refresh}>
                <ArrowsClockwise size={15} /> Muat ulang
              </button>
            </div>
          </div>

          {state.error && (
            <div className="inline-error" role="alert">
              <WarningCircle size={16} />
              <span>{state.error}</span>
            </div>
          )}

          <div className="detail-cards-grid">
            <div className="detail-card">
              <div className="detail-card-top">
                <span className="detail-card-label">Nomor Kontrak Rental</span>
                <FileText size={18} weight="duotone" className="detail-card-icon" />
              </div>
              <div className="detail-card-main">
                <span className="detail-card-val detail-card-val--mono">{state.data.id}</span>
                <span className="detail-card-sub">Nomor Referensi Resmi</span>
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-card-top">
                <span className="detail-card-label">Unit Armada Alat Berat</span>
                <Truck size={18} weight="duotone" className="detail-card-icon" />
              </div>
              <div className="detail-card-main">
                <span className="detail-card-val">{state.data.equipmentId}</span>
                <span className="detail-card-sub">Unit Terdaftar di Inventaris</span>
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-card-top">
                <span className="detail-card-label">Periode Sewa Operasional</span>
                <CalendarBlank size={18} weight="duotone" className="detail-card-icon" />
              </div>
              <div className="detail-card-main">
                <span className="detail-card-val" style={{ fontSize: '14.5px' }}>
                  {formatDate(state.data.startTime)} – {formatDate(state.data.endTime)}
                </span>
                <span className="detail-card-sub">Durasi Sewa: {diffDays} hari</span>
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-card-top">
                <span className="detail-card-label">Nominal Jaminan Deposit</span>
                <ShieldCheck size={18} weight="duotone" className="detail-card-icon" />
              </div>
              <div className="detail-card-main">
                <span className="detail-card-val detail-card-val--accent">
                  {formatCurrency(state.data.depositAmount, state.data.currency)}
                </span>
                <span className="detail-card-sub">Mata Uang: {state.data.currency}</span>
              </div>
            </div>

            {state.data.contractorId && (
              <div className="detail-card">
                <div className="detail-card-top">
                  <span className="detail-card-label">Penyewa (Contractor ID)</span>
                  <UserIcon size={18} weight="duotone" className="detail-card-icon" />
                </div>
                <div className="detail-card-main">
                  <span className="detail-card-val detail-card-val--mono">{state.data.contractorId}</span>
                  <span className="detail-card-sub">Pihak Kontraktor Peminjam</span>
                </div>
              </div>
            )}

            {state.data.warehouseAdminId && (
              <div className="detail-card">
                <div className="detail-card-top">
                  <span className="detail-card-label">Admin Gudang Penanggung Jawab</span>
                  <Warehouse size={18} weight="duotone" className="detail-card-icon" />
                </div>
                <div className="detail-card-main">
                  <span className="detail-card-val detail-card-val--mono">{state.data.warehouseAdminId}</span>
                  <span className="detail-card-sub">Penyelia Alokasi Armada</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </WorkflowPage>
  )
}

function InspectionPage() {
  const { id = '' } = useParams()
  const [state, setState] = useState<ViewState<Rental>>({ status: 'loading' })
  const [rentalEtag, setRentalEtag] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submittedInspection, setSubmittedInspection] = useState<Inspection | null>(null)
  const [idempotencyKey] = useState(createIdempotencyKey)
  const [form, setForm] = useState({ status: 'pass' as CreateInspectionInput['status'], inspectedAt: localDateTime(), notes: '', defectSummary: '' })

  useEffect(() => {
    const controller = new AbortController()
    void getRental(id, controller.signal)
      .then(({ data, etag }) => {
        if (!data) {
          setState({ status: 'error', message: 'Rental tidak ditemukan.' })
          return
        }
        setState({ status: 'content', data, fetchedAt: new Date(), stale: false })
        setRentalEtag(etag)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof ApiClientError && error.status === 403
          ? 'Akun ini belum memiliki akses untuk membuka rental.'
          : error instanceof ApiClientError && error.status === 404
            ? 'Rental tidak ditemukan.'
            : 'Rental gagal dimuat. Periksa koneksi lalu coba lagi.'
        setState({ status: 'error', message })
      })

    return () => controller.abort()
  }, [attempt, id])

  const refreshRental = async () => {
    invalidateApiResponse(`/rentals/${encodeURIComponent(id)}`)
    const latest = await getRental(id)
    if (!latest.data) throw new Error('Rental tidak ditemukan.')
    setState({ status: 'content', data: latest.data, fetchedAt: new Date(), stale: false })
    setRentalEtag(latest.etag)
  }

  const submitInspection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (state.status !== 'content' || !rentalEtag) return

    setSubmitting(true)
    setFieldErrors({})
    setFormError('')
    const payload: CreateInspectionInput = {
      equipmentId: state.data.equipmentId,
      status: form.status,
      inspectedAt: new Date(form.inspectedAt).toISOString(),
      notes: form.notes.trim(),
      defectSummary: form.defectSummary.trim() || undefined,
    }

    try {
      const { data } = await createInspection(id, payload, idempotencyKey, rentalEtag)
      if (data) {
        setSubmittedInspection(data)
      }
    } catch (error: unknown) {
      if (!(error instanceof ApiClientError)) {
        setFormError('Inspeksi belum terkirim. Periksa koneksi lalu coba lagi; key pengiriman akan tetap sama.')
      } else if (error.status === 400) {
        setFieldErrors(fieldErrorsFromProblem(error.problem))
        setFormError(error.problem.detail || 'Periksa kembali data inspeksi.')
      } else if (error.status === 422) {
        setFormError(error.problem.detail || 'Inspeksi tidak memenuhi aturan proses.')
      } else if (error.status === 409) {
        setFormError(error.problem.detail || 'Inspeksi ini berbenturan dengan data yang sudah tercatat.')
      } else if (error.status === 412) {
        setFormError('Status rental berubah sejak dibuka. Data terbaru dimuat; periksa kembali sebelum mengirim ulang.')
        try {
          await refreshRental()
        } catch {
          setFormError('Status rental berubah, tetapi data terbaru gagal dimuat. Muat ulang halaman sebelum mencoba lagi.')
        }
      } else if (error.status === 403) {
        setFormError('Akun ini tidak memiliki izin untuk mengirim inspeksi.')
      } else if (error.status === 404) {
        setFormError('Rental tidak ditemukan.')
      } else {
        setFormError('Inspeksi gagal disimpan. Coba lagi beberapa saat.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const headerActions = (
    <NavLink to="/inspection" className="secondary-button" style={{ textDecoration: 'none' }}>
      <ArrowLeft size={15} /> Antrean Tugas
    </NavLink>
  )

  return (
    <WorkflowPage
      title={submittedInspection ? "Tanda Bukti Inspeksi" : "Lembar Audit Inspeksi Alat"}
      subtitle={submittedInspection ? `Laporan audit kepatuhan kelaikan untuk rental ${id} berhasil diterbitkan.` : `Formulir pelaporan kelaikan operasional untuk kontrak ${id}.`}
      kicker="OPERASI LAPANGAN / LEMBAR INSPEKSI"
      actions={headerActions}
    >
      {submittedInspection ? (
        <div className="inspection-success-card">
          <div className="inspection-success-icon">
            <CheckCircle size={32} weight="bold" />
          </div>
          <h2 className="inspection-success-title">Inspeksi Berhasil Dicatat</h2>
          <p className="inspection-success-desc">
            Laporan kelaikan operasional untuk unit alat berat telah tersimpan secara resmi dalam sistem audit kelaikan.
          </p>
          <div className="inspection-success-details">
            <div className="inspection-success-row">
              <span className="inspection-success-label">Nomor Laporan Inspeksi</span>
              <span className="inspection-success-val">{submittedInspection.id}</span>
            </div>
            <div className="inspection-success-row">
              <span className="inspection-success-label">Nomor Kontrak Sewa</span>
              <span className="inspection-success-val">{submittedInspection.rentalId}</span>
            </div>
            <div className="inspection-success-row">
              <span className="inspection-success-label">Unit Alat Berat</span>
              <span className="inspection-success-val">{submittedInspection.equipmentId}</span>
            </div>
            <div className="inspection-success-row">
              <span className="inspection-success-label">Status Hasil Kelaikan</span>
              <span className={`status-pill status-pill--${submittedInspection.status}`}>
                <span>
                  {submittedInspection.status === 'pass' ? 'Lulus (Pass) – Siap Operasi' :
                   submittedInspection.status === 'fail' ? 'Perlu Perbaikan (Fail)' :
                   submittedInspection.status === 'pending_review' ? 'Menunggu Peninjauan' : 'Sedang Diperiksa'}
                </span>
              </span>
            </div>
            <div className="inspection-success-row">
              <span className="inspection-success-label">Waktu Pemeriksaan</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {formatDate(submittedInspection.inspectedAt)}
              </span>
            </div>
            {submittedInspection.notes && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-main)', fontSize: '13px' }}>
                <span className="inspection-success-label" style={{ display: 'block', marginBottom: '4px' }}>Catatan Petugas:</span>
                <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>"{submittedInspection.notes}"</span>
              </div>
            )}
          </div>
          <div className="inspection-success-actions">
            <NavLink to="/inspection" className="primary-button" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} weight="bold" /> Kembali ke Antrean Tugas
            </NavLink>
            <NavLink to={`/rentals/${encodeURIComponent(id)}`} className="secondary-button" style={{ textDecoration: 'none' }}>
              <FileText size={16} weight="duotone" /> Lihat Detail Kontrak
            </NavLink>
          </div>
        </div>
      ) : (
        <>
          {state.status === 'loading' && (
            <div className="skeleton-wrap" role="status">
              <div className="skeleton-row" style={{ height: '48px' }} />
              <div className="skeleton-row" style={{ height: '140px' }} />
              <div className="skeleton-row" style={{ height: '44px' }} />
            </div>
          )}
          {state.status === 'error' && (
            <div className="view-message view-message--error" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <WarningCircle size={22} weight="duotone" color="#ff8a80" />
                <strong>Rental tidak dapat dibuka</strong>
              </div>
              <p>{state.message}</p>
              <button className="secondary-button" type="button" onClick={() => setAttempt((count) => count + 1)}>
                <ArrowsClockwise size={15} /> Coba lagi
              </button>
            </div>
          )}
          {state.status === 'empty' && (
            <div className="view-message view-message--empty">
              <div className="empty-icon-wrap">
                <FolderOpen size={32} weight="duotone" />
              </div>
              <strong>Rental tidak ditemukan</strong>
            </div>
          )}
          {state.status === 'content' && (
            <>
              <div className="glass-panel" style={{ padding: '16px 22px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span className="table-id-badge">
                    <FileText size={15} weight="duotone" />
                    <span>{state.data.id}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <Truck size={17} weight="duotone" style={{ color: 'var(--lime)' }} />
                    <span>Alat: {state.data.equipmentId}</span>
                  </span>
                </div>
                <span className="sync-time-badge">Dimuat {state.fetchedAt.toLocaleTimeString('id-ID')}</span>
              </div>

              {!rentalEtag && (
                <div className="inline-error" role="alert">
                  <WarningCircle size={16} />
                  <span>Service tidak memberikan ETag rental; inspeksi belum dapat dikirim secara aman (If-Match requirement).</span>
                </div>
              )}

              <div className="form-panel">
                <form onSubmit={(event) => void submitInspection(event)}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="inspection-status">Hasil Pemeriksaan Kelaikan</label>
                    <select
                      id="inspection-status"
                      className="form-select"
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CreateInspectionInput['status'] }))}
                    >
                      <option value="pass">Lulus (Pass) – Unit Siap Operasi</option>
                      <option value="fail">Perlu Perbaikan (Fail) – Ditemukan Kerusakan</option>
                      <option value="pending_review">Menunggu Peninjauan (Pending Review)</option>
                      <option value="in_progress">Sedang Diperiksa (In Progress)</option>
                    </select>
                    {fieldErrors.status && <span className="field-error" role="alert">{fieldErrors.status}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="inspected-at">Waktu Pelaksanaan Pemeriksaan</label>
                    <input
                      id="inspected-at"
                      className="form-input"
                      type="datetime-local"
                      required
                      value={form.inspectedAt}
                      onChange={(event) => setForm((current) => ({ ...current, inspectedAt: event.target.value }))}
                    />
                    {fieldErrors.inspectedAt && <span className="field-error" role="alert">{fieldErrors.inspectedAt}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="inspection-notes">Catatan & Temuan Kondisi Mesin</label>
                    <textarea
                      id="inspection-notes"
                      className="form-textarea"
                      required
                      rows={4}
                      placeholder="Deskripsikan kondisi fisik, oli/hidrolik, kelistrikan, dan catatan kelayakan operasional..."
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    />
                    {fieldErrors.notes && <span className="field-error" role="alert">{fieldErrors.notes}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="defect-summary">
                      Ringkasan Kerusakan & Cacat <span>(Opsional)</span>
                    </label>
                    <textarea
                      id="defect-summary"
                      className="form-textarea"
                      rows={3}
                      placeholder="Rincian suku cadang atau komponen yang aus/rusak jika ada..."
                      value={form.defectSummary}
                      onChange={(event) => setForm((current) => ({ ...current, defectSummary: event.target.value }))}
                    />
                    {fieldErrors.defectSummary && <span className="field-error" role="alert">{fieldErrors.defectSummary}</span>}
                  </div>

                  {formError && (
                    <div className="inline-error" role="alert">
                      <WarningCircle size={16} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <button
                    className="primary-button"
                    type="submit"
                    style={{ width: '100%', minHeight: '44px', marginTop: '8px' }}
                    disabled={submitting || !rentalEtag}
                  >
                    <span>{submitting ? 'Mengirim Hasil...' : 'Kirim Hasil Inspeksi'}</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </WorkflowPage>
  )
}

function parseJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload) as Record<string, unknown>
  } catch {
    return null
  }
}

function roleNames(user: User): string[] {
  const roles = new Set<string>()

  const profile = user.profile as Record<string, unknown> | undefined
  if (profile) {
    const realmAccess = profile.realm_access as { roles?: unknown } | undefined
    if (Array.isArray(realmAccess?.roles)) {
      realmAccess.roles.forEach((r) => typeof r === 'string' && roles.add(r))
    }
    if (Array.isArray(profile.roles)) {
      profile.roles.forEach((r) => typeof r === 'string' && roles.add(r))
    }
  }

  const accessPayload = parseJwtPayload(user.access_token)
  if (accessPayload) {
    const realmAccess = accessPayload.realm_access as { roles?: unknown } | undefined
    if (Array.isArray(realmAccess?.roles)) {
      realmAccess.roles.forEach((r) => typeof r === 'string' && roles.add(r))
    }
    if (Array.isArray(accessPayload.roles)) {
      accessPayload.roles.forEach((r) => typeof r === 'string' && roles.add(r))
    }
  }

  const username = String(profile?.preferred_username || profile?.name || '').toLowerCase()
  if (username.includes('contractor')) roles.add('contractor')
  if (username.includes('warehouse-admin') || username.includes('admin')) roles.add('warehouse-admin')
  if (username.includes('field-operator') || username.includes('operator')) roles.add('field-operator')

  return Array.from(roles)
}

function RoleGate({ allowed, children }: { allowed: string[]; children: ReactNode }) {
  const { user } = useAuth()
  const roles = user ? roleNames(user) : []
  if (roles.some((role) => allowed.includes(role))) return children
  return (
    <WorkflowPage title="Akses tidak tersedia">
      <div className="view-message view-message--error" role="alert">
        <strong>Akun ini tidak dapat membuka workflow tersebut.</strong>
        <p>Masuk dengan akun yang memiliki peran sesuai untuk melanjutkan.</p>
      </div>
    </WorkflowPage>
  )
}

function SignInPage() {
  const { signIn } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const routeState = location.state as { sessionExpired?: boolean; loginFailed?: boolean; errorMessage?: string } | null
  const returnTo = location.pathname === '/sign-in'
    ? '/rentals'
    : `${location.pathname}${location.search}`

  const handleSignIn = async () => {
    try {
      await signIn(returnTo)
    } catch {
      setError('Layanan autentikasi belum dapat dijangkau. Coba lagi beberapa saat.')
    }
  }

  return (
    <main className="sign-in-screen">
      <div className="sign-in-panel">
        <div className="brand-name" style={{ fontSize: '36px', marginBottom: '14px', justifyContent: 'center' }}>
          KAJA<span>.</span>
        </div>
        <div className="page-kicker" style={{ justifyContent: 'center' }}>
          <span>Sistem Operasional Rental</span>
        </div>
        <p className="sign-in-desc" style={{ marginTop: '14px' }}>
          Kelola sewa alat berat, pantau kelaikan armada, dan kelola dokumen kontrak proyek Anda.
        </p>

        <div className="roles-overview-box">
          <span className="roles-overview-title">Cakupan Akses Sistem</span>
          <div className="roles-showcase-grid">
            <div className="role-info-card">
              <div className="role-info-header">
                <HardHat size={16} weight="duotone" className="role-info-icon" />
                <span>Kontraktor</span>
              </div>
              <span className="role-info-desc">Sewa armada & pantau status kontrak aktif</span>
            </div>
            <div className="role-info-card">
              <div className="role-info-header">
                <Warehouse size={16} weight="duotone" className="role-info-icon" />
                <span>Admin Gudang</span>
              </div>
              <span className="role-info-desc">Kelola inventaris & alokasi unit sewa</span>
            </div>
            <div className="role-info-card">
              <div className="role-info-header">
                <Wrench size={16} weight="duotone" className="role-info-icon" />
                <span>Operator Lapangan</span>
              </div>
              <span className="role-info-desc">Catat kepatuhan & inspeksi fisik</span>
            </div>
          </div>
        </div>

        {routeState?.sessionExpired && (
          <div className="inline-error" role="status" style={{ justifyContent: 'center' }}>
            <WarningCircle size={16} />
            <span>Sesi berakhir. Silakan masuk kembali.</span>
          </div>
        )}
        {routeState?.loginFailed && (
          <div className="inline-error" role="alert" style={{ justifyContent: 'center' }}>
            <WarningCircle size={16} />
            <span>{routeState.errorMessage ? `Autentikasi tidak berhasil: ${routeState.errorMessage}` : 'Autentikasi tidak berhasil. Coba masuk kembali.'}</span>
          </div>
        )}
        {error && (
          <div className="inline-error" role="alert" style={{ justifyContent: 'center' }}>
            <WarningCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          className="primary-button"
          type="button"
          style={{ width: '100%', minHeight: '44px', fontSize: '15px' }}
          onClick={() => void handleSignIn()}
        >
          <span>Masuk ke Portal</span>
          <SignIn size={18} weight="bold" />
        </button>

        <div className="demo-account-box">
          <div className="demo-account-header">
            <ShieldCheck size={14} weight="duotone" />
            <span>Kredensial Pengujian Demo (Password: test123)</span>
          </div>
          <div className="demo-account-list">
            <div className="demo-account-row">
              <span>Penyewa (Contractor):</span>
              <code className="demo-account-badge">contractor-a</code>
            </div>
            <div className="demo-account-row">
              <span>Admin Gudang:</span>
              <code className="demo-account-badge">warehouse-admin-a</code>
            </div>
            <div className="demo-account-row">
              <span>Operator Lapangan:</span>
              <code className="demo-account-badge">field-operator-a</code>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function InspectionStartPage() {
  const [state, setState] = useState<ViewState<Rental[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [manualRentalId, setManualRentalId] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    let controller: AbortController | null = null

    const loadAssignedRentals = async () => {
      controller = new AbortController()
      try {
        const { data } = await getRentals(controller.signal)
        if (!active) return
        const rows = data ?? []
        setState(rows.length
          ? { status: 'content', data: rows, fetchedAt: new Date(), stale: false }
          : { status: 'empty', data: rows, fetchedAt: new Date() })
      } catch (error: unknown) {
        if (!active || controller?.signal.aborted) return
        const message = rentalLoadError(error)
        setState((current) => current.status === 'content'
          ? { ...current, stale: true, error: message }
          : { status: 'error', message })
      }
    }

    void loadAssignedRentals()
    const interval = window.setInterval(() => void loadAssignedRentals(), 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
      controller?.abort()
    }
  }, [attempt])

  const refresh = () => {
    setState((current) => current.status === 'content'
      ? { ...current, stale: true, error: undefined }
      : current)
    setAttempt((current) => current + 1)
  }

  const openManualInspection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (manualRentalId.trim()) {
      navigate(`/rentals/${encodeURIComponent(manualRentalId.trim())}/inspection`)
    }
  }

  const rentals = state.status === 'content' ? state.data : []
  const filteredRentals = rentals.filter((r) => {
    return (
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.equipmentId.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const totalAssigned = rentals.length
  const pendingInspection = rentals.filter((r) => r.status === 'approved' || r.status === 'active' || r.status === 'in_progress').length
  const completedCount = rentals.filter((r) => r.status === 'completed').length

  return (
    <WorkflowPage
      title="Tugas Inspeksi Lapangan"
      subtitle="Daftar unit armada alat berat yang ditugaskan kepada Anda untuk inspeksi fisik dan kelaikan operasional."
      kicker="Operator Lapangan / Antrean Tugas"
    >
      {state.status === 'loading' && (
        <div className="skeleton-wrap" role="status">
          <div className="skeleton-row" style={{ height: '90px' }} />
          <div className="skeleton-row" style={{ height: '48px', width: '60%' }} />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <div className="error-icon-wrap">
            <WifiSlash size={28} weight="duotone" />
          </div>
          <strong>Gagal memuat tugas inspeksi</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={refresh}>
            <ArrowsClockwise size={15} /> Coba lagi
          </button>
        </div>
      )}

      {state.status === 'empty' && (
        <>
          <div className="view-message view-message--empty">
            <div className="empty-icon-wrap">
              <FolderOpen size={28} weight="duotone" />
            </div>
            <strong>Belum ada penugasan inspeksi</strong>
            <p>Saat ini belum ada kontrak rental yang dialokasikan ke jadwal operator Anda.</p>
            <span className="sync-time-badge">
              Sinkron terakhir {state.fetchedAt.toLocaleTimeString('id-ID')}
            </span>
          </div>

          <div className="lookup-form" style={{ marginTop: '24px' }}>
            <label htmlFor="manual-rental-empty">Atau periksa unit melalui ID Rental manual:</label>
            <form onSubmit={openManualInspection} className="lookup-controls">
              <input
                id="manual-rental-empty"
                placeholder="Contoh: rnt_3MnB7xP"
                value={manualRentalId}
                onChange={(e) => setManualRentalId(e.target.value)}
                required
              />
              <button className="primary-button" type="submit">
                <span>Buka Inspeksi</span>
              </button>
            </form>
          </div>
        </>
      )}

      {state.status === 'content' && (
        <>
          {/* Summary Metric Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Total Penugasan</span>
                <span className="metric-value">{totalAssigned}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--primary">
                <FileText size={22} weight="duotone" />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Perlu Diperiksa</span>
                <span className="metric-value">{pendingInspection}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--warning">
                <Wrench size={22} weight="duotone" />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-content">
                <span className="metric-label">Selesai / Ditutup</span>
                <span className="metric-value">{completedCount}</span>
              </div>
              <div className="metric-icon-wrap metric-icon--success">
                <CheckCircle size={22} weight="duotone" />
              </div>
            </div>
          </div>

          {/* List Toolbar */}
          <div className="list-toolbar">
            <div className="toolbar-search-wrap">
              <MagnifyingGlass size={16} className="toolbar-search-icon" />
              <input
                type="search"
                className="toolbar-search-input"
                placeholder="Cari ID rental atau ID unit alat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="toolbar-actions">
              <span className={`sync-time-badge ${state.stale ? 'sync-time-badge--stale' : ''}`}>
                <span className="service-status__dot" style={{ background: state.stale ? '#ffa726' : '#66bb6a' }} />
                {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
              </span>
              <button className="secondary-button" type="button" onClick={refresh}>
                <ArrowsClockwise size={15} /> Muat ulang
              </button>
            </div>
          </div>

          {state.error && (
            <div className="inline-error" role="alert">
              <WarningCircle size={16} />
              <span>{state.error} Menampilkan data terakhir yang berhasil dimuat.</span>
            </div>
          )}

          {/* Table */}
          <div className="table-wrap">
            <table className="rental-table">
              <thead>
                <tr>
                  <th>Rental ID</th>
                  <th>Unit Alat</th>
                  <th>Periode Operasional</th>
                  <th className="col-center">Status Kontrak</th>
                  <th className="col-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRentals.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Tidak ada penugasan inspeksi yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredRentals.map((rental) => (
                    <tr key={rental.id}>
                      <td>
                        <NavLink className="table-id-badge" to={`/rentals/${encodeURIComponent(rental.id)}`}>
                          <FileText size={14} weight="duotone" />
                          <span>{rental.id}</span>
                        </NavLink>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                          <Truck size={17} weight="duotone" style={{ color: 'var(--lime)' }} />
                          <span>{rental.equipmentId}</span>
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <CalendarBlank size={14} />
                          <span>{formatDate(rental.startTime)} – {formatDate(rental.endTime)}</span>
                        </span>
                      </td>
                      <td className="col-center">
                        <span className={`status-pill status-pill--${rental.status}`}>
                          <span>{rentalStatusLabel(rental.status)}</span>
                        </span>
                      </td>
                      <td className="col-center">
                        <NavLink
                          className="primary-button table-action-btn"
                          to={`/rentals/${encodeURIComponent(rental.id)}/inspection`}
                        >
                          <Wrench size={13} weight="bold" />
                          <span>Inspeksi</span>
                        </NavLink>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Manual Lookup Option */}
          <div className="lookup-form" style={{ marginTop: '28px', maxWidth: '100%' }}>
            <label htmlFor="manual-rental-input">Pemeriksaan Cepat dengan ID Manual</label>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
              Jika unit tidak tercantum dalam daftar penugasan otomatis, masukkan ID rental langsung dari Surat Perintah Kerja (SPK):
            </p>
            <form onSubmit={openManualInspection} className="lookup-controls" style={{ maxWidth: '520px' }}>
              <input
                id="manual-rental-input"
                placeholder="Contoh: rnt_3MnB7xP"
                value={manualRentalId}
                onChange={(e) => setManualRentalId(e.target.value)}
                required
              />
              <button className="secondary-button" type="submit">
                <span>Buka Inspeksi</span>
              </button>
            </form>
          </div>
        </>
      )}
    </WorkflowPage>
  )
}

function Workspace() {
  const { user, loading, signOut } = useAuth()
  const location = useLocation()

  if (location.pathname === '/callback') {
    return <main className="auth-pending" role="status">Mengamankan sesi...</main>
  }

  if (loading) return <main className="auth-pending" role="status">Memeriksa sesi...</main>
  if (!user || location.pathname === '/sign-in') {
    return user ? <Navigate to="/rentals" replace /> : <SignInPage />
  }

  const roles = roleNames(user)
  const canReadRentals = roles.includes('contractor') || roles.includes('warehouse-admin')
  const canViewCatalogue = roles.includes('contractor') || roles.includes('warehouse-admin')
  const canInspect = roles.includes('field-operator')
  const displayName = String(user.profile.name || user.profile.preferred_username || 'Pengguna')
  const roleDisplayLabel = roles.includes('contractor')
    ? 'Kontraktor'
    : roles.includes('warehouse-admin')
    ? 'Admin Gudang'
    : roles.includes('field-operator')
    ? 'Operator Lapangan'
    : 'Anggota'

  const roleIcon = roles.includes('contractor')
    ? <HardHat size={14} weight="duotone" />
    : roles.includes('warehouse-admin')
    ? <Warehouse size={14} weight="duotone" />
    : <Wrench size={14} weight="duotone" />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to={canInspect ? '/inspection' : '/rentals'} aria-label="Kaja home">
          <span className="brand-name">KAJA<span>.</span></span>
        </NavLink>
        <nav className="main-nav" aria-label="Workflow">
          {canReadRentals && (
            <NavLink to="/rentals" end className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
              <span className="nav-icon"><FileText size={18} weight="duotone" /></span>
              <span style={{ flex: 1 }}>{roles.includes('warehouse-admin') ? 'Kontrak Gudang' : 'Rental Berjalan'}</span>
            </NavLink>
          )}
          {canViewCatalogue && (
            <NavLink to="/equipments" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
              <span className="nav-icon">
                {roles.includes('warehouse-admin') ? <Warehouse size={18} weight="duotone" /> : <PlusCircle size={18} weight="duotone" />}
              </span>
              <span style={{ flex: 1 }}>{roles.includes('warehouse-admin') ? 'Inventaris Gudang' : 'Katalog Alat'}</span>
            </NavLink>
          )}
          {canInspect && (
            <NavLink to="/inspection" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
              <span className="nav-icon"><Wrench size={18} weight="duotone" /></span>
              <span style={{ flex: 1 }}>Tugas Inspeksi</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="role-badge-pill">
            {roleIcon}
            <span>{roleDisplayLabel}</span>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-account">
            <div className="user-avatar-chip">
              <div className="user-avatar-initials">{displayName.slice(0, 2).toUpperCase()}</div>
              <span className="user-display-name">{displayName}</span>
            </div>
            <button className="signout-button" type="button" onClick={() => void signOut()} title="Keluar dari akun">
              <SignOut size={15} weight="bold" />
              <span>Keluar</span>
            </button>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to={canInspect ? '/inspection' : '/rentals'} replace />} />
          <Route path="/rentals" element={<RoleGate allowed={['contractor', 'warehouse-admin']}><RentalListPage /></RoleGate>} />
          <Route path="/equipments" element={<RoleGate allowed={['contractor', 'warehouse-admin']}><EquipmentCataloguePage /></RoleGate>} />
          <Route path="/rentals/new" element={<RoleGate allowed={['contractor']}><RentalRequestPage /></RoleGate>} />
          <Route path="/rentals/:id" element={<RoleGate allowed={['contractor', 'warehouse-admin', 'field-operator']}><RentalDetailPage /></RoleGate>} />
          <Route path="/rentals/:id/inspection" element={<RoleGate allowed={['field-operator']}><InspectionPage /></RoleGate>} />
          <Route path="/inspection" element={<RoleGate allowed={['field-operator']}><InspectionStartPage /></RoleGate>} />
          <Route path="*" element={<WorkflowPage title="Halaman tidak ditemukan" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Workspace />
      </AuthProvider>
    </BrowserRouter>
  )
}
