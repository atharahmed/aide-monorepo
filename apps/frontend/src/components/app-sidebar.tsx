import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BarChart2,
  BookOpen,
  Building2,
  Cable,
  ChevronsUpDown,
  CreditCard,
  Home,
  Inbox,
  LogOut,
  MessagesSquare,
  Search,
  Settings,
  Tag,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { initialsOf } from '@/lib/format'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarToggle,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo, Wordmark } from '@/components/logo'
import { canSeeReports } from '@/features/onboarding/actions'
import type { Me } from '@/types/api'

interface NavItem {
  label: string
  to: string
  search?: Record<string, string>
  icon: typeof Home
  visible: (user: Me | undefined) => boolean
  /** Matched against the current path to decide the active state. */
  match?: (pathname: string, search: string) => boolean
}

/* Conversations, Topics and Scenarios are always shown — each page prompts to
 * connect a ticket source when there is none, rather than hiding itself. */
const mainNav: NavItem[] = [
  { label: 'Home', to: '/home', icon: Home, visible: (user) => Boolean(user?.team) },
  {
    label: 'Conversations',
    to: '/conversations',
    icon: Inbox,
    visible: (user) => Boolean(user?.team),
    match: (pathname, search) =>
      pathname.startsWith('/conversations') && !search.includes('view=simulator'),
  },
  {
    label: 'Simulator',
    to: '/conversations',
    search: { view: 'simulator' },
    icon: MessagesSquare,
    visible: (user) => Boolean(user?.team),
    match: (pathname, search) =>
      pathname.startsWith('/conversations') && search.includes('view=simulator'),
  },
  { label: 'Topics', to: '/topics', icon: Tag, visible: (user) => Boolean(user?.team) },
  { label: 'Scenarios', to: '/scenarios', icon: Zap, visible: (user) => Boolean(user?.team) },
  { label: 'Knowledge', to: '/knowledge', icon: BookOpen, visible: (user) => Boolean(user?.team) },
  { label: 'Reports', to: '/reports', icon: BarChart2, visible: canSeeReports },
]

const settingsNav: NavItem[] = [
  { label: 'Team', to: '/team', icon: Users, visible: (user) => Boolean(user?.team) },
  {
    label: 'Integrations',
    to: '/integrations',
    icon: Cable,
    visible: (user) => Boolean(user?.team),
  },
]

export function AppSidebar({
  user,
  onOpenSearch,
}: {
  user: Me | undefined
  onOpenSearch: () => void
}) {
  const { collapsed } = useSidebar()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { location } = useRouterState()

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(location.pathname, location.searchStr)
      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)

  const signOut = () => {
    /* Revoke server-side, but never block the exit on it — the local token is
     * what actually gates the app, and a failed revoke must not trap the user. */
    void api.post('/v1/logout').catch(() => {})
    clearToken()
    queryClient.clear()
    navigate({ to: '/login' })
  }

  return (
    <Sidebar>
      <SidebarHeader>
        {/* Collapsed, there is no room beside the mark, so the toggle stacks
            under it rather than shrinking the brand into a corner. */}
        <div className={cn('flex items-center gap-1 justify-between', collapsed && 'flex-col gap-0.5')}>
          <Link
            to="/home"
            className={cn(
              'flex h-7 w-fit items-center gap-2 rounded-[6px] px-1.5 transition-colors',
              collapsed && 'w-fit flex-none justify-center px-0'
            )}
          >
            <Logo />
            {!collapsed && (
              <span className="flex min-w-0 flex-col leading-tight">
                <Wordmark />
                {/* <span className="truncate text-[11.5px] text-gray-500">
                  {user?.team?.name ?? 'Loading…'}
                </span> */}
              </span>
            )}
          </Link>
          <SidebarToggle className="hidden md:flex" />
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            'flex h-8 items-center gap-2 rounded-[6px] border border-black/5 bg-white px-2 text-[13px] text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600',
            collapsed && 'justify-center px-0'
          )}
        >
          <Search className="size-3.5 shrink-0" />
          {!collapsed && (
            <>
              <span>Search</span>
              <kbd className="ml-auto font-mono text-[11px] text-gray-400">⌘K</kbd>
            </>
          )}
        </button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>

          <SidebarMenu>
            {mainNav
              .filter((item) => item.visible(user))
              .map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                    <Link to={item.to} search={item.search as never}>
                      <item.icon />
                      <SidebarLabel>{item.label}</SidebarLabel>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {settingsNav
              .filter((item) => item.visible(user))
              .map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon />
                      <SidebarLabel>{item.label}</SidebarLabel>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex h-10 w-full items-center gap-2 rounded-[6px] px-1.5 text-left transition-colors hover:bg-gray-100',
                collapsed && 'justify-center px-0'
              )}
            >
              <Avatar>
                <AvatarFallback>{initialsOf(user?.name ?? '')}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13px] font-medium text-gray-800">
                      {user?.name}
                    </span>
                    <span className="truncate text-[12px] text-gray-400 font-medium">{user?.team?.name}</span>
                  </span>
                  <ChevronsUpDown className="size-3.5 shrink-0 text-gray-400" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/settings/account">
                <User />
                Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/billing">
                <CreditCard />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
