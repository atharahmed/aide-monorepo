import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Copy, Loader2, MoreHorizontal, RotateCw, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/components/page-header'
import { ErrorState } from '@/components/empty-state'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useDeleteInvite, useInviteTeammates, useMe, useResendInvite, useTeam } from '@/lib/queries'
import { formatDay, formatRelative } from '@/lib/format'
import type { TeamMember } from '@/types/api'

export const Route = createFileRoute('/_authenticated/team')({
  component: TeamPage,
})

function TeamPage() {
  const { data: user } = useMe()
  const { data: members, isLoading, isError, refetch } = useTeam()
  const [inviteOpen, setInviteOpen] = useState(false)

  const active = (members ?? []).filter((member) => member.active)
  const invited = (members ?? []).filter((member) => !member.active)

  return (
    <>
      <PageHeader
        title="Team"
        description={`Everyone with access to ${user?.team?.name ?? 'this workspace'}.`}
        actions={
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus />
            Invite people
          </Button>
        }
      />

      <PageBody className="flex flex-col gap-8">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isError ? (
          <ErrorState
            title="Could not load your team"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            <section>
              <h2 className="mb-3 text-[19px] font-medium text-gray-950">
                Members{' '}
                <span className="font-normal text-gray-400 tabular-nums">{active.length}</span>
              </h2>

              <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="w-[140px]">Last active</TableHead>
                      <TableHead className="w-[120px]">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <span className="flex items-center gap-2.5">
                            <Avatar className="size-6">
                              <AvatarFallback>{member.initials}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-gray-950">{member.name}</span>
                            {member.id === user?.id && <Badge variant="neutral">You</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-500">{member.email}</TableCell>
                        <TableCell className="text-gray-500">
                          {formatRelative(member.last_seen_at)}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {formatDay(member.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {invited.length > 0 && (
              <section>
                <h2 className="mb-3 text-[19px] font-medium text-gray-950">
                  Pending invitations{' '}
                  <span className="font-normal text-gray-400 tabular-nums">{invited.length}</span>
                </h2>

                <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Email</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[120px]">Invited</TableHead>
                        <TableHead className="w-[52px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invited.map((member) => (
                        <InviteRow key={member.id} member={member} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}
          </>
        )}
      </PageBody>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  )
}

function InviteRow({ member }: { member: TeamMember }) {
  const resendInvite = useResendInvite()
  const deleteInvite = useDeleteInvite()
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    await navigator.clipboard.writeText(member.invite_url)
    setCopied(true)
    toast.success('Invite link copied')
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <TableRow>
      <TableCell className="text-gray-950">{member.email}</TableCell>
      <TableCell>
        {member.status === 'expired' ? (
          <Badge variant="warning">Expired</Badge>
        ) : (
          <Badge variant="neutral">
            <StatusDot />
            Pending
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-gray-500">{formatDay(member.created_at)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Manage invite for ${member.email}`}>
              <MoreHorizontal className="text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={copyLink}>
              {copied ? <Check /> : <Copy />}
              Copy invite link
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                resendInvite.mutate(member.id, {
                  onSuccess: () => toast.success(`Invite resent to ${member.email}`),
                })
              }
            >
              <RotateCw />
              Resend invite
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                deleteInvite.mutate(member.id, {
                  onSuccess: () => toast.success('Invite revoked'),
                })
              }
            >
              <Trash2 />
              Revoke invite
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inviteTeammates = useInviteTeammates()
  const [raw, setRaw] = useState('')

  const emails = raw
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.includes('@'))

  const submit = () =>
    inviteTeammates.mutate(emails, {
      onSuccess: (result) => {
        onOpenChange(false)
        setRaw('')
        if (result.emails_taken.length > 0) {
          toast.warning(
            `${result.invites_sent} invited. Already on a team: ${result.emails_taken.join(', ')}`
          )
        } else {
          toast.success(
            `Invited ${result.invites_sent} teammate${result.invites_sent === 1 ? '' : 's'}`
          )
        }
      },
      onError: () => toast.error('Could not send the invitations. Try again.'),
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            They get access to every conversation, topic and scenario in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="emails">Email addresses</Label>
          <Input
            id="emails"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            className="mt-1.5"
            placeholder="priya@company.com, marcus@company.com"
          />
          <p className="mt-1.5 text-[12px] text-gray-400">
            {emails.length > 0
              ? `${emails.length} address${emails.length === 1 ? '' : 'es'} ready`
              : 'Separate several addresses with commas or spaces.'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={emails.length === 0 || inviteTeammates.isPending}>
            {inviteTeammates.isPending && <Loader2 className="animate-spin" />}
            Send {emails.length > 0 ? emails.length : ''} invitation
            {emails.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
