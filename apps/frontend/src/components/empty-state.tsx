import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Empty screens are an invitation to act, so every one names the next step.
 * Keep the copy specific — "No conversations match these filters" beats
 * "Nothing here".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[8px] border border-dashed border-black/5 bg-white px-6 py-14 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex size-9 items-center justify-center rounded-[8px] border border-black/5 bg-gray-50 text-gray-400">
          {icon}
        </div>
      )}
      <p className="text-[14px] font-medium tracking-[-0.02em] text-gray-950">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Could not load this page',
  description = 'The request failed. Try again, and if it keeps happening let us know.',
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] border border-destructive-200 bg-destructive-50 px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-destructive-800">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-destructive-700">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
