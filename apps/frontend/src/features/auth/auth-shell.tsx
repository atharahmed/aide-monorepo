import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Logo, Wordmark } from '@/components/logo'
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
        <Logo className="size-6" />
        <Wordmark className="text-[16px]" />
      </Link>

      <div className={cn('w-full', wide ? 'max-w-lg' : 'max-w-[380px]')}>
        <div className="rounded-[8px] border border-black/5 bg-white p-6">
          <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-gray-950">{title}</h1>
          {description && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">{description}</p>
          )}
          <div className="mt-5">{children}</div>
        </div>

        {footer && <div className="mt-4 text-center text-[13px] text-gray-500">{footer}</div>}
      </div>
    </div>
  )
}

export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  return (
    <a
      href="/v1/auth/google/redirect"
      className="flex h-9 w-full items-center justify-center gap-2 rounded-[6px] border border-black/5 bg-white text-[13px] font-medium text-gray-800 transition-colors hover:bg-gray-50"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
        <path
          fill="currentColor"
          d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.7 0 2.84.73 3.5 1.35l2.38-2.3A9 9 0 1 0 12 21c5.2 0 8.63-3.65 8.63-8.8 0-.6-.06-1.05-.14-1.5Z"
        />
      </svg>
      {label}
    </a>
  )
}

export function AuthDivider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="text-[11.5px] text-gray-400">or</span>
      <span className="h-px flex-1 bg-gray-200" />
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
