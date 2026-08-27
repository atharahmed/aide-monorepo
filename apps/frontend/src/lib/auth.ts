/**
 * Session cookie, kept byte-compatible with AdonisJS plain cookies.
 *
 * `aide_token` is not ours alone to define. The backend writes it directly at
 * the end of the Google OAuth flow via `response.plainCookie`, so the encoding
 * is Adonis's: base64**url** of `{"message": "<token>"}` — `+`/`/` swapped for
 * `-`/`_` and the `=` padding stripped. `atob` rejects that alphabet, which is
 * why decoding normalises before it decodes.
 *
 * The cookie is written on a shared parent domain so every `*.aide.app`
 * surface reads the same session. Both the format and the domain are
 * load-bearing; do not "simplify" either.
 *
 * `VITE_COOKIE_DOMAIN` is unset locally (host-only cookie on localhost) and set
 * to `aide.app` in deployed environments.
 */

const COOKIE_NAME = 'aide_token'

/** Matches the 6-day expiry on the bearer token the API issues. */
const MAX_AGE_SECONDS = 6 * 24 * 60 * 60

const COOKIE_DOMAIN = import.meta.env.VITE_COOKIE_DOMAIN || ''

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  /* Restore the padding `atob` insists on but base64url omits. */
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

function cookieAttributes(maxAge: number) {
  const attributes = ['path=/', `max-age=${maxAge}`, 'SameSite=Lax']
  if (COOKIE_DOMAIN) attributes.push(`domain=${COOKIE_DOMAIN}`)
  if (window.location.protocol === 'https:') attributes.push('Secure')
  return attributes.join('; ')
}

export function readToken(): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE_NAME}=`))

  if (!match) return null

  try {
    const encoded = decodeURIComponent(match.slice(COOKIE_NAME.length + 1))
    const parsed = JSON.parse(base64UrlDecode(encoded)) as { message?: string }
    return parsed.message ?? null
  } catch {
    return null
  }
}

export function writeToken(token: string) {
  const value = base64UrlEncode(JSON.stringify({ message: token }))
  document.cookie = `${COOKIE_NAME}=${value}; ${cookieAttributes(MAX_AGE_SECONDS)}`
}

export function clearToken() {
  /* Clear both scopes: a host-only cookie left over from an earlier session
   * would otherwise shadow the domain-wide one and keep the user signed in. */
  document.cookie = `${COOKIE_NAME}=; ${cookieAttributes(0)}`
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}

export const isAuthenticated = () => readToken() !== null
