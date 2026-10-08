/**
 * A small wrapper around fetch() for the Django API.
 *
 * - Auth tokens live in httpOnly cookies, so this code never sees them: the browser sends them itself.
 * - Unsafe requests (POST/PATCH/DELETE) carry Django's CSRF token from the `csrftoken` cookie.
 * - If the short-lived access token has expired (401), we refresh it once and repeat the request.
 * - Errors become ApiError with a stable `code`, which the UI translates to RU/EN.
 */

export class ApiError extends Error {
  status: number
  code: string
  data: unknown

  constructor(status: number, code: string, message: string, data: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.data = data
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  params?: Query
}

// A 401 from these endpoints means "wrong password" or "no session" — refreshing would not help.
const NO_REFRESH = new Set(['/api/auth/login/', '/api/auth/refresh/', '/api/auth/logout/', '/api/auth/csrf/'])

let language = 'en'
let onSessionExpired: () => void = () => {}
let refreshing: Promise<boolean> | null = null

export function setApiLanguage(lang: string) {
  language = lang
}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

export function getCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

async function ensureCsrfCookie() {
  if (!getCookie('csrftoken')) {
    await fetch('/api/auth/csrf/', { credentials: 'same-origin' })
  }
}

export function buildUrl(path: string, params?: Query): string {
  const query = new URLSearchParams()
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

/** One refresh at a time: if five requests get 401 together, they all wait for the same refresh. */
function refreshSession(): Promise<boolean> {
  refreshing ??= send('/api/auth/refresh/', { method: 'POST' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function send(path: string, { method = 'GET', body, params }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': language }
  if (method !== 'GET') {
    await ensureCsrfCookie()
    headers['X-CSRFToken'] = getCookie('csrftoken') ?? ''
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  return fetch(buildUrl(path, params), {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Turns a DRF error response into a readable message: {"detail": ...} or {"field": ["error"]}. */
export function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.detail === 'string') return record.detail
    for (const [field, value] of Object.entries(record)) {
      const first = Array.isArray(value) ? value[0] : value
      if (typeof first === 'string') return field === 'non_field_errors' ? first : `${field}: ${first}`
    }
  }
  return fallback
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && !NO_REFRESH.has(path)) {
    if (await refreshSession()) {
      response = await send(path, options)
    } else {
      onSessionExpired()
    }
  }

  if (response.status === 204) return undefined as T

  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code =
      data && typeof data === 'object' && 'code' in data
        ? String((data as { code: unknown }).code)
        : `http_${response.status}`
    throw new ApiError(response.status, code, errorMessage(data, response.statusText), data)
  }
  return data as T
}
