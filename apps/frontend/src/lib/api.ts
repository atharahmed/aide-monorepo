/**
 * The single HTTP client. Every call goes through here with an explicit
 * versioned path (`/v1/...`, `/v2/...`) — the v5 app string-replaced the base
 * URL to switch versions, which is why deep links kept breaking.
 *
 * `VITE_API_URL` is the API root with no version segment: the v5 dashboard's
 * `NEXT_PUBLIC_API_BASE` included `/v1`, this one does not.
 */

import { clearToken, readToken } from './auth'

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3333'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string
  ) {
    super(message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
  }

  /**
   * Adonis validation failures, flattened to field → message. The v5 API is
   * inconsistent about this: `request.validate` emits
   * `{errors: [{field, message}]}`, while several controllers hand-roll
   * `{errors: {field: message}}` or `{errors: {field: [message]}}`.
   */
  get fieldErrors(): Record<string, string> {
    const body = this.body as
      | { errors?: Array<{ field: string; message: string }> | Record<string, string | string[]> }
      | undefined

    if (!body?.errors) return {}

    if (Array.isArray(body.errors)) {
      return Object.fromEntries(body.errors.map((error) => [error.field, error.message]))
    }

    return Object.fromEntries(
      Object.entries(body.errors).map(([field, message]) => [
        field,
        Array.isArray(message) ? message[0] : message,
      ])
    )
  }

  get displayMessage(): string {
    /* Several endpoints reply with a bare string body rather than JSON. */
    if (typeof this.body === 'string' && this.body.trim()) return this.body

    const body = this.body as { message?: string; error?: string } | undefined
    const firstFieldError = Object.values(this.fieldErrors)[0]
    return body?.message ?? body?.error ?? firstFieldError ?? this.message
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

interface RequestOptions {
  query?: Query
  body?: unknown
  skipAuthRedirect?: boolean
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
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

  const payload = await readBody(response)

  if (!response.ok) throw new ApiError(response.status, payload)

  return payload as T
}

/**
 * Reads the body without trusting `Content-Type`. The v5 API sends JSON with no
 * content type from some handlers, plain text from others (the integration
 * redirect returns a bare URL), and an empty body from several success paths —
 * `response.json()` throws on all three.
 */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>('POST', path, { body, query }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  request,
}
