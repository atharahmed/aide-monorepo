import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const SIDEBAR_WIDTH = '15rem'
const SIDEBAR_WIDTH_ICON = '3.25rem'
const SIDEBAR_STORAGE_KEY = 'aide:sidebar:collapsed'

type SidebarContextValue = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggle: () => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider')
  return context
}

export function SidebarProvider({ children, className, ...props }: React.ComponentProps<'div'>) {
  const [collapsed, setCollapsedState] = React.useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
  )
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const setCollapsed = React.useCallback((next: boolean) => {
    setCollapsedState(next)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0')
  }, [])

  const toggle = React.useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'b' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = React.useMemo(
    () => ({ collapsed, setCollapsed, toggle, mobileOpen, setMobileOpen }),
    [collapsed, setCollapsed, toggle, mobileOpen]
  )

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-collapsed={collapsed}
        style={
          {
            '--sidebar-width': collapsed ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH,
          } as React.CSSProperties
        }
        /* The shell is exactly one viewport tall and never scrolls itself.
         * With `min-h-screen` it grew to fit its content instead, so every
         * `overflow-y-auto` pane inside was measured against a parent that had
         * already stretched — nothing scrolled independently and the whole page
         * scrolled as one. */
        className={cn('flex h-dvh w-full overflow-hidden bg-black/3', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({ className, children, ...props }: React.ComponentProps<'aside'>) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar()
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-950/25 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        data-collapsed={collapsed}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] shrink-0 flex-col border border-black/8 bg-white/90 backdrop-blur-md transition-transform duration-200 rounded-[20px] m-1.5 mr-1',
          'md:sticky md:top-0 md:translate-x-0 md:transition-[width] md:duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 p-2.5', className)} {...props} />
}

export function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 scrollbar-thin flex-col gap-4 overflow-y-auto px-2.5',
        className
      )}
      {...props}
    />
  )
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-2.5', className)} {...props} />
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-0.5', className)} {...props} />
}

export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'div'>) {
  const { collapsed } = useSidebar()
  if (collapsed) return <div className="h-2" />
  return (
    <div
      className={cn(
        'px-2 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase',
        className
      )}
      {...props}
    />
  )
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('flex flex-col gap-0.5', className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('relative', className)} {...props} />
}

export function SidebarMenuButton({
  className,
  asChild,
  isActive,
  tooltip,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string
}) {
  const { collapsed } = useSidebar()
  const Comp = asChild ? Slot : 'button'

  const button = (
    <Comp
      data-active={isActive}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-[6px] px-2 text-[13px] font-medium text-gray-600 transition-colors',
        'hover:bg-black/5 hover:text-gray-950',
        'data-[active=true]:bg-black/5 data-[active=true]:text-gray-950',
        "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        collapsed && 'justify-center px-0',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )

  if (!collapsed || !tooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/** Hides its children when the sidebar is collapsed to icons. */
export function SidebarLabel({ className, ...props }: React.ComponentProps<'span'>) {
  const { collapsed } = useSidebar()
  if (collapsed) return null
  return <span className={cn('truncate', className)} {...props} />
}

export function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden mx-auto mt-1.5 mr-1.5 mb-1.5 border border-black/8 rounded-[22px] bg-white', className)}
      {...props}
    />
  )
}

/**
 * The visible collapse control.
 *
 * `SidebarRail` below gives the edge of the sidebar a drag-like affordance, but
 * it is a 12px transparent strip — fine as a shortcut once you know it is
 * there, useless for discovering that the sidebar collapses at all. This is the
 * button people actually find.
 */
export function SidebarToggle({ className, ...props }: React.ComponentProps<'button'>) {
  const { collapsed, toggle } = useSidebar()
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={!collapsed}
          onClick={toggle}
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-[6px] text-gray-400 transition-colors',
            'hover:bg-gray-100 hover:text-gray-700',
            '[&_svg]:size-4 [&_svg]:shrink-0',
            className
          )}
          {...props}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label} <span className="text-gray-400">⌘B</span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Thin hover strip on the sidebar's edge that toggles collapse. */
export function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
  const { toggle } = useSidebar()
  return (
    <button
      type="button"
      aria-label="Toggle sidebar"
      title="Toggle sidebar (⌘B)"
      onClick={toggle}
      className={cn(
        'absolute inset-y-0 -right-1.5 hidden w-3 cursor-col-resize md:block',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent after:transition-colors hover:after:bg-gray-300',
        className
      )}
      {...props}
    />
  )
}
