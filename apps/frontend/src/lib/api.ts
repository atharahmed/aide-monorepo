/**
 * The single HTTP client. Every call goes through here with an explicit
 * versioned path (`/v1/...`, `/v2/...`) — the v5 app string-replaced the base
 * URL to switch versions, which is why deep links kept breaking.
 *
 * Phase 1 talks to MSW. Phase 2 sets `VITE_USE_MOCKS=false` and the same calls
 * hit the real v7 API; Tuyau types get adopted per feature from there.
 */

import { clearToken, readToken } from './auth'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3333'
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string
  ) {
    super(message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
  }

  /** Laravel/Adonis-style validation errors, flattened to field → message. */
  get fieldErrors(): Record<string, string> {
    const body = this.body as
      { errors?: Array<{ field: string; message: string }> | Record<string, string> } | undefined

    if (!body?.errors) return {}
    if (Array.isArray(body.errors)) {
      return Object.fromEntries(body.errors.map((error) => [error.field, error.message]))
    }
    return body.errors
  }

  get displayMessage(): string {
    const body = this.body as { message?: string } | undefined
    const firstFieldError = Object.values(this.fieldErrors)[0]
    return body?.message ?? firstFieldError ?? this.message
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

function buildUrl(path: string, query?: Query) {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_BASE)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/** 401 anywhere means the session is gone — drop the cookie and bounce. */
function handleUnauthorized() {
  clearToken()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = `/login?next=${encodeURIComponent(
      window.location.pathname + window.location.search
    )}`
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { query?: Query; body?: unknown; skipAuthRedirect?: boolean } = {}
): Promise<T> {
  const token = readToken()

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401 && !options.skipAuthRedirect) {
    handleUnauthorized()
    throw new ApiError(401, null, 'Session expired')
  }

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) throw new ApiError(response.status, payload)

  return payload as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>('POST', path, { body, query }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  request,
}
