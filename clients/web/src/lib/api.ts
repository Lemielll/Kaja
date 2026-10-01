const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4010/v1').replace(/\/+$/, '')
const API_ORIGIN = new URL(API_BASE_URL).origin
let accessToken: string | null = null
let unauthorizedHandler: (() => void) | null = null
const responseCache = new Map<string, { data: unknown; etag: string }>()

export function setAccessToken(token: string | null) {
  if (accessToken !== token) responseCache.clear()
  accessToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export function invalidateApiResponse(path: string) {
  const url = path === '/health' ? `${API_ORIGIN}${path}` : `${API_BASE_URL}${path}`
  responseCache.delete(url)
}

export type ApiProblem = {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  'invalid-params'?: Array<{ field?: string; reason?: string }>
  errors?: Array<{ field?: string; reason?: string }>
}

export type ApiResult<T> = {
  data: T | null
  etag: string | null
  notModified: boolean
}

export type Rental = {
  id: string
  equipmentId: string
  contractorId: string
  warehouseAdminId: string
  status: string
  startTime: string
  endTime: string
  depositAmount: number
  currency: string
  createdAt: string
  updatedAt: string
}

export type Equipment = {
  id: string
  type: string
  status: string
  hourlyRate: number
  currency: string
  location: string
  createdAt: string
  updatedAt: string
}

export type CreateRentalInput = {
  equipmentId: string
  warehouseAdminId: string
  startTime: string
  endTime: string
  depositAmount: number
  currency: string
}

export type CreateInspectionInput = {
  equipmentId: string
  status: 'pending_review' | 'in_progress' | 'pass' | 'fail'
  inspectedAt: string
  notes: string
  defectSummary?: string
}

export type Inspection = {
  id: string
  rentalId: string
  equipmentId: string
  operatorId: string
  status: 'pending_review' | 'in_progress' | 'pass' | 'fail'
  inspectedAt: string
  notes: string
  defectSummary?: string
  createdAt?: string
  updatedAt?: string
}

export class ApiClientError extends Error {
  readonly status: number
  readonly problem: ApiProblem
  readonly etag: string | null

  constructor(status: number, problem: ApiProblem, etag: string | null = null) {
    super(problem.detail || problem.title || 'Permintaan tidak dapat diproses.')
    this.name = 'ApiClientError'
    this.status = status
    this.problem = problem
    this.etag = etag
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json, application/problem+json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const url = path === '/health' ? `${API_ORIGIN}${path}` : `${API_BASE_URL}${path}`
  const method = (init.method || 'GET').toUpperCase()
  const cached = method === 'GET' ? responseCache.get(url) : undefined
  if (cached?.etag && !headers.has('If-None-Match')) {
    headers.set('If-None-Match', cached.etag)
  }

  const response = await fetch(url, { ...init, headers })
  const etag = response.headers.get('ETag') ?? (response.status === 304 ? cached?.etag ?? null : null)

  if (response.status === 304) {
    return { data: (cached?.data as T | undefined) ?? null, etag, notModified: true }
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as ApiProblem
    if (response.status === 401) {
      accessToken = null
      responseCache.clear()
      unauthorizedHandler?.()
    }
    throw new ApiClientError(response.status, problem, etag)
  }

  const data = response.status === 204
    ? null
    : await response.json() as T

  if (method === 'GET' && data !== null && etag) {
    responseCache.set(url, { data, etag })
  } else if (method !== 'GET') {
    responseCache.clear()
  }

  return { data, etag, notModified: false }
}

export async function getRentals(signal?: AbortSignal) {
  return apiRequest<Rental[]>('/rentals', { signal })
}

export async function getEquipments(signal?: AbortSignal) {
  return apiRequest<Equipment[]>('/equipments', { signal })
}

export async function getRental(id: string, signal?: AbortSignal) {
  return apiRequest<Rental>(`/rentals/${encodeURIComponent(id)}`, { signal })
}

export function createIdempotencyKey() {
  return crypto.randomUUID()
}

export async function createRental(input: CreateRentalInput, idempotencyKey: string) {
  return apiRequest<Rental>('/rentals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(input),
  })
}

export async function createInspection(id: string, input: CreateInspectionInput, idempotencyKey: string, ifMatch: string) {
  return apiRequest<Inspection>(`/rentals/${encodeURIComponent(id)}/inspections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'If-Match': ifMatch,
    },
    body: JSON.stringify(input),
  })
}

export function fieldErrorsFromProblem(problem: ApiProblem) {
  const details = problem['invalid-params'] ?? problem.errors ?? []
  return Object.fromEntries(details.flatMap(({ field, reason }) => {
    if (!field || !reason) return []
    return [[field.replace(/^(body|query)\./, ''), reason]]
  }))
}