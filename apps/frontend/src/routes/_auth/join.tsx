import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/features/auth/auth-shell'
import { isAuthenticated } from '@/lib/auth'
import { parseWidgetSource, type WidgetSource } from '@/features/auth/widget-handoff'
import { useInviteDetails } from '@/lib/queries'
import { searchString } from '@/lib/search'

export const Route = createFileRoute('/_auth/join')({
  validateSearch: (
    search: Record<string, unknown>
  ): { code?: string; source?: WidgetSource; originOverride?: string } => ({
    code: searchString(search.code) ?? '',
    source: parseWidgetSource(search.source),
    originOverride: searchString(search.originOverride),
  }),
  /* Reached from a helpdesk panel with a session already in hand: skip straight
   * to the token handoff rather than re-accepting an invite. */
  beforeLoad: ({ search }) => {
    if (!isAuthenticated()) return

    if (search.source) {
      throw redirect({
        to: '/login/widget',
        search: { source: search.source, originOverride: search.originOverride },
      })
    }

    throw redirect({ to: '/home' })
  },
  component: JoinPage,
})

function JoinPage() {
  const { code = '' } = Route.useSearch()
  const { data: invite, isLoading, isError } = useInviteDetails(code)

  if (isLoading) {
    return (
      <AuthShell title="Checking your invite">
        <div className="flex items-center gap-2 text-[13px] text-gray-500">
          <Loader2 className="size-4 animate-spin text-gray-400" />
          One moment…
        </div>
      </AuthShell>
    )
  }

  if (isError || !invite) {
    return (
      <AuthShell
        title="This invite is no longer valid"
        description="It may have expired or already been used. Ask a teammate to send a new one."
        footer={
          <Link to="/login" className="text-gray-800 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Button variant="outline" className="w-full" asChild>
          <a href="mailto:support@aide.app">Contact support</a>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={`Join ${invite.team_name} on Aide`}
      description={`${invite.invited_by} invited ${invite.email}.`}
    >
      <Button size="lg" className="w-full" asChild>
        <Link to="/register" search={{ invite: invite.invite_code }}>
          Accept invite
        </Link>
      </Button>
      <p className="mt-3 text-[12px] text-gray-400">
        You will set your name and password next.
      </p>
    </AuthShell>
  )
}
