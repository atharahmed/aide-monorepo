import type { ReactNode } from 'react'
import { PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'

/**
 * Every page opens the same way: title on the left, primary action on the
 * right, an optional row of tabs sitting on the header's bottom rule.
 */
export function PageHeader({
  title,
  description,
  actions,
  tabs,
  meta,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tabs?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  const { setMobileOpen } = useSidebar()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-gray-200 bg-gray-50/85 backdrop-blur-sm',
        className
      )}
    >
      <div className="flex min-h-[52px] items-center gap-3 px-4 pt-3 pb-3 md:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <PanelLeft />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-gray-950">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="mt-0.5 truncate text-[13px] text-gray-500">{description}</p>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {tabs && <div className="-mb-px px-4 md:px-6">{tabs}</div>}
    </header>
  )
}

/** Standard page body padding, so every route lines up on the same grid. */
export function PageBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex-1 px-4 py-6 md:px-6', className)} {...props} />
}
