import { Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { AppSidebar } from '@/components/app-sidebar'
import { BillingBanner, BillingLockModal } from '@/components/billing-gate'
import { CommandPalette, useCommandPalette } from '@/components/command-palette'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { getBillingState } from '@/features/onboarding/actions'
import { isAuthenticated } from '@/lib/auth'
import { meQueryOptions, useMe } from '@/lib/queries'
import { ApiError } from '@/lib/api'

/**
 * The authenticated shell. The `/me` payload is fetched once in the loader and
 * every page below reads it from the query cache — this is what replaced the
 * Recoil `userAtom`.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/login', search: { next: location.href } })
    }
  },
  loader: async ({ context }) => {
    try {
      const me = await context.queryClient.ensureQueryData(meQueryOptions)
      /* A team that has not finished onboarding never reaches the shell. */
      if (me.team?.show_onboarding) throw redirect({ to: '/start' })
      return me
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/login' })
      }
      throw error
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const { data: user } = useMe()
  const { location } = useRouterState()
  const palette = useCommandPalette()

  const billingState = getBillingState(user, location.pathname)

  return (
    <SidebarProvider>
      <AppSidebar user={user} onOpenSearch={() => palette.setOpen(true)} />

      <SidebarInset>
        {billingState && <BillingBanner state={billingState} />}
        <Outlet />
      </SidebarInset>

      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      {billingState && <BillingLockModal state={billingState} />}
    </SidebarProvider>
  )
}
