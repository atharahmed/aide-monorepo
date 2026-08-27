import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDismissOnboardingAction } from '@/lib/queries'
import type { Me } from '@/types/api'
import {
  getOnboardingActions,
  getOnboardingReminders,
  type OnboardingAction,
  type OnboardingPage,
} from './actions'

function ActionLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  const isExternal = href.startsWith('http://') || href.startsWith('https://')
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

/** The dismissible chips that sit under a page title. */
export function OnboardingReminders({
  user,
  page,
  className,
}: {
  user: Me | undefined
  page: OnboardingPage
  className?: string
}) {
  const dismiss = useDismissOnboardingAction()
  const actions = getOnboardingReminders(user, page).slice(0, 3)

  if (!user || actions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {actions.map((action) => {
        const href = action.resolveLink(user)
        if (!href) return null

        return (
          <span
            key={action.slug}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-2.5 text-[12px] font-medium transition-colors',
              action.reminder?.emphasis
                ? 'border-gray-950 bg-gray-950 text-gray-50 hover:bg-gray-800'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-950'
            )}
          >
            <ActionLink href={href}>{action.reminder?.body}</ActionLink>
            <button
              type="button"
              aria-label={`Dismiss ${action.reminder?.body}`}
              onClick={() => dismiss.mutate(action.slug)}
              className={cn(
                'rounded-full p-0.5 transition-colors',
                action.reminder?.emphasis
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-50'
                  : 'text-gray-300 hover:bg-gray-100 hover:text-gray-700'
              )}
            >
              <X className="size-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

/** The card grid used on Home and in empty states. */
export function OnboardingActionBoxes({
  user,
  page,
  limit,
  callbacks = {},
  className,
}: {
  user: Me | undefined
  page: OnboardingPage
  limit?: number
  /** Slug → click handler, for actions that open a dialog instead of navigating. */
  callbacks?: Record<string, () => void>
  className?: string
}) {
  const actions = getOnboardingActions(user, page)
  const visible = limit ? actions.slice(0, limit) : actions

  if (!user || visible.length === 0) return null

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {visible.map((action) => (
        <ActionBox key={action.slug} action={action} user={user} onClick={callbacks[action.slug]} />
      ))}
    </div>
  )
}

function ActionBox({
  action,
  user,
  onClick,
}: {
  action: OnboardingAction
  user: Me
  onClick?: () => void
}) {
  const href = action.resolveLink(user)

  const content = (
    <>
      <div className="flex size-8 items-center justify-center rounded-[6px] border border-gray-200 bg-gray-50">
        {action.icon}
      </div>
      <div className="mt-3 flex-1">
        <p className="text-[13.5px] font-medium tracking-[-0.01em] text-gray-950">{action.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
          {action.actionBox.description}
        </p>
      </div>
    </>
  )

  const button = action.actionBox.buttonText ? (
    <span className="mt-4 inline-flex h-7 items-center rounded-[6px] bg-gray-950 px-2.5 text-[12.5px] font-medium text-white transition-colors group-hover:bg-gray-800">
      {action.actionBox.buttonText}
    </span>
  ) : null

  const classes =
    'group flex h-full flex-col rounded-[8px] border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300'

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
        {button}
      </button>
    )
  }

  if (!href) {
    return (
      <div className={classes}>
        {content}
        {button}
      </div>
    )
  }

  return (
    <ActionLink href={href} className={classes}>
      {content}
      {button}
    </ActionLink>
  )
}

/** Empty-state variant: title + the top actions, used when a page has no data. */
export function OnboardingEmptyState({
  user,
  page,
  title,
  description,
  fallback,
}: {
  user: Me | undefined
  page: OnboardingPage
  title: string
  description?: string
  fallback?: React.ReactNode
}) {
  const actions = getOnboardingActions(user, page)

  return (
    <div className="mx-auto max-w-3xl py-10 text-center">
      <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.03em] text-gray-950">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-2.5 max-w-lg text-[14px] leading-relaxed text-gray-500">
          {description}
        </p>
      )}
      {actions.length > 0 ? (
        <OnboardingActionBoxes user={user} page={page} limit={3} className="mt-7 text-left" />
      ) : (
        fallback && <div className="mt-7">{fallback}</div>
      )}
    </div>
  )
}
