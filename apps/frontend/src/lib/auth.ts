/**
 * Token storage. The cookie format is inherited from the v5 app — a base64
 * blob wrapping `{ message: token }` — because the Front/Zendesk widget and the
 * marketing site both read it. Do not "simplify" it.
 */

const COOKIE_NAME = 'aide_token'
const MAX_AGE_DAYS = 30

export function readToken(): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${COOKIE_NAME}=`))

  if (!match) return null

  try {
    const encoded = decodeURIComponent(match.slice(COOKIE_NAME.length + 1))
    const parsed = JSON.parse(atob(encoded)) as { message?: string }
    return parsed.message ?? null
  } catch {
    return null
  }
}

export function writeToken(token: string) {
  const value = encodeURIComponent(btoa(JSON.stringify({ message: token })))
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function clearToken() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}

export const isAuthenticated = () => readToken() !== null
