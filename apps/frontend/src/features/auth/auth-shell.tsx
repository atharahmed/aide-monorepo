import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo, Wordmark } from '@/components/logo'
import { API_BASE } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Centred card on the gray-50 canvas — the same frame for every auth screen. */
export function AuthShell({
  title,
  description,
  children,
  footer,
  wide,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link to="/home" className="mb-7 inline-flex items-center gap-2">
        <Logo className="size-8" />
        <Wordmark className="text-[16px]" />
      </Link>
      <h1 className="text-[21px] font-medium tracking-[-0.02em] text-gray-950 mb-3.5">{title}</h1>

      <div className={cn('w-full', wide ? 'max-w-lg' : 'max-w-[380px]')}>
        <div className="rounded-[20px] border border-black/8 bg-white p-6">
          {description && (
            <p className="mb-2 text-[13px] leading-relaxed text-gray-500 flex justify-center">{description}</p>
          )}
          <div className="mt-0">{children}</div>
        </div>

        {footer && <div className="mt-4 text-center text-[13px] text-gray-500">{footer}</div>}
      </div>
    </div>
  )
}

/**
 * A full page navigation to the API, not a fetch: the provider round-trip ends
 * with the backend setting the session cookie itself and redirecting back.
 * `invite` is forwarded so an invited user joins the right team.
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
    <a
      href={href}
      className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-black/10 bg-white text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50"
    >
<svg fill="none" height="15" viewBox="0 0 16 16" width="15" xmlns="http://www.w3.org/2000/svg" class="ak-AuthButtonIcon"><g><path d="M15.83 8.18C15.83 7.65333 15.7833 7.15333 15.7033 6.66667H8.17V9.67333H12.4833C12.29 10.66 11.7233 11.4933 10.8833 12.06V14.06H13.4567C14.9633 12.6667 15.83 10.6133 15.83 8.18Z" fill="#4285F4"></path><path d="M8.17 16C10.33 16 12.1367 15.28 13.4567 14.06L10.8833 12.06C10.1633 12.54 9.25 12.8333 8.17 12.8333C6.08334 12.8333 4.31667 11.4267 3.68334 9.52667H1.03V11.5867C2.34334 14.2 5.04334 16 8.17 16Z" fill="#34A853"></path><path d="M3.68334 9.52667C3.51667 9.04667 3.43 8.53333 3.43 8C3.43 7.46667 3.52334 6.95334 3.68334 6.47334V4.41334H1.03C0.483335 5.49334 0.170002 6.70667 0.170002 8C0.170002 9.29333 0.483335 10.5067 1.03 11.5867L3.68334 9.52667Z" fill="#FBBC05"></path><path d="M8.17 3.16667C9.35 3.16667 10.4033 3.57334 11.2367 4.36667L13.5167 2.08667C12.1367 0.793334 10.33 0 8.17 0C5.04334 0 2.34334 1.8 1.03 4.41334L3.68334 6.47334C4.31667 4.57334 6.08334 3.16667 8.17 3.16667Z" fill="#EA4335"></path></g></svg>
      {label}
    </a>
  )
}

export function AuthDivider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-black/5" />
      <span className="text-[11.5px] text-gray-400">or</span>
      <span className="h-px flex-1 bg-black/5" />
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1.5 text-[12.5px] text-destructive-600">{children}</p>
}

export function FormAlert({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <div className="mb-4 rounded-[6px] border border-destructive-200 bg-destructive-50 px-3 py-2 text-[12.5px] text-destructive-700">
      {children}
    </div>
  )
}
