import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { User } from 'oidc-client-ts'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/context'
import { ApiClientError, apiRequest, createIdempotencyKey, createInspection, createRental, fieldErrorsFromProblem, getEquipments, getRental, getRentals, invalidateApiResponse, type CreateInspectionInput, type CreateRentalInput, type Equipment, type Rental } from './lib/api'
import './App.css'

type ServiceState = 'checking' | 'online' | 'offline'

function ServiceStatus() {
  const [state, setState] = useState<ServiceState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<{ status: string }>('/health', { signal: controller.signal })
      .then(() => setState('online'))
      .catch(() => {
        if (!controller.signal.aborted) setState('offline')
      })

    return () => controller.abort()
  }, [])

  const labels: Record<ServiceState, string> = {
    checking: 'Memeriksa service',
    online: 'Service aktif',
    offline: 'Service tidak tersedia',
  }

  return (
    <div className={`service-status service-status--${state}`} role="status">
      <span className="service-status__dot" />
      {labels[state]}
    </div>
  )
}

function WorkflowPage({ title, children }: {
  title: string
  children?: ReactNode
}) {
  return (
    <section className="workflow-page">
      <div className="page-kicker">KAJA / WORKSPACE</div>
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
        </div>
        <ServiceStatus />
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
  return 'Daftar rental gagal dimuat. Periksa koneksi lalu coba lagi.'
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

  return (
    <WorkflowPage title="Rental berjalan">
      {state.status === 'loading' && <div className="view-message" role="status">Memuat daftar rental...</div>}
      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <strong>Daftar rental belum tersedia</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={refresh}>Coba lagi</button>
        </div>
      )}
      {state.status === 'empty' && (
        <div className="view-message view-message--empty">
          <strong>Belum ada rental</strong>
          <p>Rental yang tercatat untuk akun ini akan muncul di sini.</p>
          <span className="sync-time">Sinkron terakhir {state.fetchedAt.toLocaleTimeString('id-ID')}</span>
        </div>
      )}
      {state.status === 'content' && (
        <>
          <div className="list-toolbar">
            <span>{state.data.length} rental</span>
            <span className={state.stale ? 'sync-time sync-time--stale' : 'sync-time'}>
              {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
            </span>
            <button className="secondary-button" type="button" onClick={refresh}>Muat ulang</button>
          </div>
          {state.error && <p className="inline-error" role="alert">{state.error} Menampilkan data terakhir yang berhasil dimuat.</p>}
          <div className="table-wrap">
            <table className="rental-table">
              <thead><tr><th>Rental</th><th>Alat</th><th>Periode</th><th>Status</th><th /></tr></thead>
              <tbody>
                {state.data.map((rental) => (
                  <tr key={rental.id}>
                    <td><NavLink className="table-link" to={`/rentals/${encodeURIComponent(rental.id)}`}>{rental.id}</NavLink></td>
                    <td>{rental.equipmentId}</td>
                    <td>{formatDate(rental.startTime)} - {formatDate(rental.endTime)}</td>
                    <td><span className="status-label">{rentalStatusLabel(rental.status)}</span></td>
                    <td><NavLink className="table-link" to={`/rentals/${encodeURIComponent(rental.id)}`}>Lihat</NavLink></td>
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

function EquipmentCataloguePage() {
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

  return (
    <WorkflowPage title="Katalog alat">
      {state.status === 'loading' && <div className="view-message" role="status">Memuat katalog alat...</div>}
      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <strong>Katalog belum tersedia</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={() => setAttempt((count) => count + 1)}>Coba lagi</button>
        </div>
      )}
      {state.status === 'empty' && (
        <div className="view-message view-message--empty">
          <strong>Belum ada alat tersedia</strong>
          <p>Periksa kembali nanti untuk melihat alat yang dapat dijadwalkan.</p>
          <span className="sync-time">Sinkron terakhir {state.fetchedAt.toLocaleTimeString('id-ID')}</span>
        </div>
      )}
      {state.status === 'content' && (
        <>
          <div className="list-toolbar">
            <span>{state.data.length} unit tercatat</span>
            <span className={state.stale ? 'sync-time sync-time--stale' : 'sync-time'}>
              {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
            </span>
            <button className="secondary-button" type="button" onClick={refresh}>Muat ulang</button>
          </div>
          {state.error && <p className="inline-error" role="alert">{state.error} Menampilkan data terakhir yang berhasil dimuat.</p>}
          <div className="table-wrap">
            <table className="rental-table">
              <thead><tr><th>Unit</th><th>Jenis</th><th>Lokasi</th><th>Tarif / jam</th><th>Status</th><th /></tr></thead>
              <tbody>
                {state.data.map((equipment) => (
                  <tr key={equipment.id}>
                    <td>{equipment.id}</td>
                    <td>{equipment.type.replaceAll('_', ' ')}</td>
                    <td>{equipment.location}</td>
                    <td>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: equipment.currency }).format(equipment.hourlyRate)}</td>
                    <td><span className="status-label">{equipment.status === 'available' ? 'Tersedia' : equipment.status.replaceAll('_', ' ')}</span></td>
                    <td><NavLink className="table-link" to={`/rentals/new?equipmentId=${encodeURIComponent(equipment.id)}`}>Pilih</NavLink></td>
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
  const { user } = useAuth()
  const navigate = useNavigate()
  const claims = user?.profile as Record<string, unknown> | undefined
  const contractorId = typeof claims?.contractorId === 'string' ? claims.contractorId : null
  const warehouseAdminId = typeof claims?.warehouseAdminId === 'string' ? claims.warehouseAdminId : null
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
    if (!contractorId || !warehouseAdminId) {
      setFormError('Identitas kontraktor atau admin gudang belum tersedia pada sesi akun. Minta Service Owner mengonfigurasi claim domain sebelum membuat rental.')
      return
    }

    const payload: CreateRentalInput = {
      equipmentId,
      contractorId,
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
    <WorkflowPage title="Ajukan rental">
      {!equipmentId && <p className="inline-error" role="alert">Belum ada alat dipilih. <NavLink className="table-link" to="/equipments">Kembali ke katalog alat</NavLink></p>}
      {equipmentId && <p className="selected-equipment">Unit terpilih <strong>{equipmentId}</strong></p>}
      {(!contractorId || !warehouseAdminId) && <p className="inline-error" role="status">Sesi akun belum menyediakan ID kontraktor dan admin gudang yang diwajibkan kontrak. Identitas tidak akan ditebak atau diminta sebagai input bebas.</p>}
      <form className="inspection-form" onSubmit={(event) => void submitRequest(event)}>
        <label htmlFor="rental-start">Mulai sewa</label>
        <input id="rental-start" type="datetime-local" required value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} />
        {fieldErrors.startTime && <span className="field-error" role="alert">{fieldErrors.startTime}</span>}

        <label htmlFor="rental-end">Selesai sewa</label>
        <input id="rental-end" type="datetime-local" required value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} />
        {fieldErrors.endTime && <span className="field-error" role="alert">{fieldErrors.endTime}</span>}

        <label htmlFor="rental-deposit">Deposit</label>
        <input id="rental-deposit" type="number" min="0" step="1" required value={form.depositAmount} onChange={(event) => setForm((current) => ({ ...current, depositAmount: event.target.value }))} />
        {fieldErrors.depositAmount && <span className="field-error" role="alert">{fieldErrors.depositAmount}</span>}

        <label htmlFor="rental-currency">Mata uang</label>
        <input id="rental-currency" maxLength={3} required value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} />
        {fieldErrors.currency && <span className="field-error" role="alert">{fieldErrors.currency}</span>}

        {fieldErrors.equipmentId && <span className="field-error" role="alert">{fieldErrors.equipmentId}</span>}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="primary-button" type="submit" disabled={submitting || !equipmentId || !contractorId || !warehouseAdminId}>
          {submitting ? 'Mengirim...' : 'Kirim permintaan rental'}
        </button>
      </form>
    </WorkflowPage>
  )
}

function RentalDetailPage() {
  const { id = '' } = useParams()
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

  return (
    <WorkflowPage title="Detail rental">
      {state.status === 'loading' && <div className="view-message" role="status">Memuat detail rental...</div>}
      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <strong>Rental tidak dapat ditampilkan</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={refresh}>Coba lagi</button>
        </div>
      )}
      {state.status === 'empty' && <div className="view-message view-message--empty">Rental tidak ditemukan.</div>}
      {state.status === 'content' && (
        <>
          <div className="list-toolbar">
            <span className={state.stale ? 'sync-time sync-time--stale' : 'sync-time'}>
              {state.stale ? 'Data mungkin tidak mutakhir' : `Sinkron ${state.fetchedAt.toLocaleTimeString('id-ID')}`}
            </span>
            <button className="secondary-button" type="button" onClick={refresh}>Muat ulang</button>
          </div>
          {state.error && <p className="inline-error" role="alert">{state.error}</p>}
          <dl className="detail-grid">
            <div><dt>Nomor rental</dt><dd>{state.data.id}</dd></div>
            <div><dt>Alat</dt><dd>{state.data.equipmentId}</dd></div>
            <div><dt>Status</dt><dd><span className="status-label">{rentalStatusLabel(state.data.status)}</span></dd></div>
            <div><dt>Periode</dt><dd>{formatDate(state.data.startTime)} - {formatDate(state.data.endTime)}</dd></div>
            <div><dt>Deposit</dt><dd>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: state.data.currency }).format(state.data.depositAmount)}</dd></div>
          </dl>
        </>
      )}
    </WorkflowPage>
  )
}

function InspectionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state, setState] = useState<ViewState<Rental>>({ status: 'loading' })
  const [rentalEtag, setRentalEtag] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [idempotencyKey] = useState(createIdempotencyKey)
  const profile = user?.profile as Record<string, unknown> | undefined
  const operatorId = typeof profile?.operatorId === 'string' ? profile.operatorId : null
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
    if (state.status !== 'content' || !operatorId || !rentalEtag) return

    setSubmitting(true)
    setFieldErrors({})
    setFormError('')
    const payload: CreateInspectionInput = {
      equipmentId: state.data.equipmentId,
      operatorId,
      status: form.status,
      inspectedAt: new Date(form.inspectedAt).toISOString(),
      notes: form.notes.trim(),
      defectSummary: form.defectSummary.trim() || undefined,
    }

    try {
      await createInspection(id, payload, idempotencyKey, rentalEtag)
      navigate(`/rentals/${encodeURIComponent(id)}`, { replace: true })
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

  return (
    <WorkflowPage title="Pemeriksaan alat">
      {state.status === 'loading' && <div className="view-message" role="status">Memuat rental yang ditugaskan...</div>}
      {state.status === 'error' && (
        <div className="view-message view-message--error" role="alert">
          <strong>Rental tidak dapat dibuka</strong>
          <p>{state.message}</p>
          <button className="secondary-button" type="button" onClick={() => setAttempt((count) => count + 1)}>Coba lagi</button>
        </div>
      )}
      {state.status === 'empty' && <div className="view-message view-message--empty">Rental tidak ditemukan.</div>}
      {state.status === 'content' && (
        <>
          <div className="list-toolbar">
            <span>{state.data.id} / alat {state.data.equipmentId}</span>
            <span className="sync-time">Dimuat {state.fetchedAt.toLocaleTimeString('id-ID')}</span>
          </div>
          {!operatorId && <p className="inline-error" role="alert">Akun ini belum memiliki claim ID operator domain. Pengiriman dinonaktifkan sampai Service Owner memetakan claim operatorId.</p>}
          {!rentalEtag && <p className="inline-error" role="alert">Service tidak memberikan ETag rental; inspeksi belum dapat dikirim dengan aman.</p>}
          <form className="inspection-form" onSubmit={(event) => void submitInspection(event)}>
            <label htmlFor="inspection-status">Hasil pemeriksaan</label>
            <select id="inspection-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CreateInspectionInput['status'] }))}>
              <option value="pass">Lulus</option>
              <option value="fail">Perlu perbaikan</option>
              <option value="pending_review">Menunggu peninjauan</option>
              <option value="in_progress">Sedang diperiksa</option>
            </select>
            {fieldErrors.status && <span className="field-error" role="alert">{fieldErrors.status}</span>}

            <label htmlFor="inspected-at">Waktu pemeriksaan</label>
            <input id="inspected-at" type="datetime-local" required value={form.inspectedAt} onChange={(event) => setForm((current) => ({ ...current, inspectedAt: event.target.value }))} />
            {fieldErrors.inspectedAt && <span className="field-error" role="alert">{fieldErrors.inspectedAt}</span>}

            <label htmlFor="inspection-notes">Catatan kondisi</label>
            <textarea id="inspection-notes" required rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            {fieldErrors.notes && <span className="field-error" role="alert">{fieldErrors.notes}</span>}

            <label htmlFor="defect-summary">Ringkasan kerusakan <span>(opsional)</span></label>
            <textarea id="defect-summary" rows={3} value={form.defectSummary} onChange={(event) => setForm((current) => ({ ...current, defectSummary: event.target.value }))} />
            {fieldErrors.defectSummary && <span className="field-error" role="alert">{fieldErrors.defectSummary}</span>}

            {formError && <p className="form-error" role="alert">{formError}</p>}
            <button className="primary-button" type="submit" disabled={submitting || !operatorId || !rentalEtag}>
              {submitting ? 'Mengirim...' : 'Kirim hasil inspeksi'}
            </button>
          </form>
        </>
      )}
    </WorkflowPage>
  )
}

function roleNames(user: User) {
  const profile = user.profile as Record<string, unknown>
  const realmAccess = profile.realm_access as { roles?: unknown } | undefined
  return Array.isArray(realmAccess?.roles)
    ? realmAccess.roles.filter((role): role is string => typeof role === 'string')
    : []
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
  const routeState = location.state as { sessionExpired?: boolean; loginFailed?: boolean } | null
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
        <div className="brand-mark">K</div>
        <p className="page-kicker">KAJA / AKSES ANGGOTA</p>
        <h1>Masuk ke ruang kerja</h1>
        {routeState?.sessionExpired && <p role="status">Sesi berakhir. Silakan masuk kembali.</p>}
        {routeState?.loginFailed && <p role="alert">Autentikasi tidak berhasil. Coba masuk kembali.</p>}
        {error && <p role="alert">{error}</p>}
        <button className="primary-button" type="button" onClick={() => void handleSignIn()}>
          Masuk dengan akun KAJA
        </button>
      </div>
    </main>
  )
}

function InspectionStartPage() {
  const [rentalId, setRentalId] = useState('')
  const navigate = useNavigate()

  const openInspection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(`/rentals/${encodeURIComponent(rentalId.trim())}/inspection`)
  }

  return (
    <WorkflowPage title="Pemeriksaan alat">
      <form className="lookup-form" onSubmit={openInspection}>
        <label htmlFor="rental-id">ID rental yang ditugaskan</label>
        <div className="lookup-controls">
          <input id="rental-id" value={rentalId} onChange={(event) => setRentalId(event.target.value)} required />
          <button className="primary-button" type="submit">Buka rental</button>
        </div>
      </form>
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
  const canCreateRentals = roles.includes('contractor')
  const canInspect = roles.includes('field-operator')
  const displayName = String(user.profile.name || user.profile.preferred_username || 'Pengguna')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/rentals" aria-label="Kaja home">
          <span className="brand-mark">K</span>
          <span className="brand-name">KAJA<span>.</span></span>
        </NavLink>
        <div className="sidebar-label">OPERASI</div>
        <nav className="main-nav" aria-label="Workflow">
          {canReadRentals && <NavLink to="/rentals" end className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
            <span className="nav-index">01</span> Rental berjalan
          </NavLink>}
          {canCreateRentals && <NavLink to="/equipments" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
            <span className="nav-index">02</span> Buat rental
          </NavLink>}
          {canInspect && <NavLink to="/inspection" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}>
            <span className="nav-index">03</span> Pemeriksaan alat
          </NavLink>}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-caption">HEAVY EQUIPMENT</span>
          <span className="sidebar-caption">RENTAL SYSTEM</span>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>FIELD OPERATIONS</span>
          <div className="topbar-account">
            <span>{displayName}</span>
            <button type="button" onClick={() => void signOut()}>Keluar</button>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to={canInspect ? '/inspection' : '/rentals'} replace />} />
          <Route path="/rentals" element={<RoleGate allowed={['contractor', 'warehouse-admin']}><RentalListPage /></RoleGate>} />
          <Route path="/equipments" element={<RoleGate allowed={['contractor']}><EquipmentCataloguePage /></RoleGate>} />
          <Route path="/rentals/new" element={<RoleGate allowed={['contractor']}><RentalRequestPage /></RoleGate>} />
          <Route path="/rentals/:id" element={<RoleGate allowed={['contractor', 'warehouse-admin']}><RentalDetailPage /></RoleGate>} />
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
