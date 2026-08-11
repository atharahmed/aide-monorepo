import { Link, createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/features/auth/auth-shell'
import { useInviteDetails } from '@/lib/queries'

export const Route = createFileRoute('/_auth/join')({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
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
          <Link to="/login" className="font-medium text-gray-950 hover:underline">
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
      <p className="mt-3 text-center text-[12px] text-gray-400">
        You will set your name and password next.
      </p>
    </AuthShell>
  )
}
