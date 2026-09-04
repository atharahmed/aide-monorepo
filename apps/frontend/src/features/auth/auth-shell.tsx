import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatedLogo, Wordmark } from '@/components/logo'
import { API_BASE } from '@/lib/api'

/** Full-page frame for every signed-out screen: mark in the corner, form in the middle. */
export function AuthShell({
  title,
  tagline,
  description,
  children,
  footer,
}: {
  title: string
  /** Same size and weight as `title`, muted — login brand line only. */
  tagline?: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center px-6 py-5">
        <Link to="/home" className="inline-flex items-center gap-2" aria-label="Aide">
          <AnimatedLogo size={24} once />
          <Wordmark className="text-[15px]" />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 pb-40">
        <div className="w-full max-w-[340px]">
          <h1
            className={
              tagline
                ? 'text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-gray-950'
                : 'text-[24px] leading-tight font-medium tracking-[-0.03em] text-gray-950'
            }
          >
            {title}
          </h1>
          {tagline ? (
            <p className="mt-0 text-[27.5px] leading-[1.15] font-medium tracking-[-0.025em] text-nowrap text-gray-400/70">
              {tagline}
            </p>
          ) : null}
          {description ? (
            <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">{description}</p>
          ) : null}

          <div className={tagline ? 'mt-10' : 'mt-8'}>{children}</div>

          {footer ? <p className="mt-6 text-center text-[13px] text-gray-500">{footer}</p> : null}
        </div>
      </main>

      <p className="pb-6 text-center text-[12px] text-gray-400">
        <a
          href="https://aide.app/terms"
          className="hover:text-gray-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </a>
        {' and '}
        <a
          href="https://aide.app/privacy"
          className="hover:text-gray-600"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </a>
      </p>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M15.83 8.18C15.83 7.65333 15.7833 7.15333 15.7033 6.66667H8.17V9.67333H12.4833C12.29 10.66 11.7233 11.4933 10.8833 12.06V14.06H13.4567C14.9633 12.6667 15.83 10.6133 15.83 8.18Z"
        fill="#4285F4"
      />
      <path
        d="M8.17 16C10.33 16 12.1367 15.28 13.4567 14.06L10.8833 12.06C10.1633 12.54 9.25 12.8333 8.17 12.8333C6.08334 12.8333 4.31667 11.4267 3.68334 9.52667H1.03V11.5867C2.34334 14.2 5.04334 16 8.17 16Z"
        fill="#34A853"
      />
      <path
        d="M3.68334 9.52667C3.51667 9.04667 3.43 8.53333 3.43 8C3.43 7.46667 3.52334 6.95334 3.68334 6.47334V4.41334H1.03C0.483335 5.49334 0.170002 6.70667 0.170002 8C0.170002 9.29333 0.483335 10.5067 1.03 11.5867L3.68334 9.52667Z"
        fill="#FBBC05"
      />
      <path
        d="M8.17 3.16667C9.35 3.16667 10.4033 3.57334 11.2367 4.36667L13.5167 2.08667C12.1367 0.793334 10.33 0 8.17 0C5.04334 0 2.34334 1.8 1.03 4.41334L3.68334 6.47334C4.31667 4.57334 6.08334 3.16667 8.17 3.16667Z"
        fill="#EA4335"
      />
    </svg>
  )
}

/**
 * A full page navigation to the API, not a fetch: the provider round-trip ends
 * with the backend setting the session cookie itself and redirecting back.
 * `invite` is forwarded so an invited user joins the right team.
 *
 * Laid out as a social-provider row so more providers can sit beside Google
 * later without changing the page structure.
 */
export function GoogleButton({
  label = 'Continue with Google',
  invite,
}: {
  label?: string
  invite?: string
}) {
  const href = `${API_BASE}/v1/auth/google/redirect${
    invite ? `?invite=${encodeURIComponent(invite)}` : ''
  }`

  return (
    <div className="flex gap-2">
      <a
        href={href}
        aria-label={label}
        className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[8px] border border-black/10 bg-white text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50"
      >
        <GoogleGlyph />
        {label}
      </a>
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p className="mt-1.5 text-[12.5px] text-destructive-600 first-letter:uppercase">{children}</p>
  )
}

export function FormAlert({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div className="mb-4 rounded-[8px] border border-destructive-200 bg-destructive-50 px-3 py-2 text-[12.5px] text-destructive-700">
      {children}
    </div>
  )
}
