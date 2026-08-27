import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Logo, Wordmark } from '@/components/logo'
import { queryKeys } from '@/lib/queries'
import { formatDay } from '@/lib/format'
import type { Me } from '@/types/api'

/**
 * Internal admin page. Deliberately outside the app shell and deliberately
 * plain — it is a tool, not a product surface.
 */
export const Route = createFileRoute('/account-management')({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' })
  },
  component: AccountManagementPage,
})

function AccountManagementPage() {
  const queryClient = useQueryClient()
  const [accountId, setAccountId] = useState('')
  const [switching, setSwitching] = useState(false)

  /* Both reports answer with a full `/me` payload per account — the first user
   * of each — rather than a purpose-built row. */
  const recent = useQuery({
    queryKey: queryKeys.adminAccounts,
    queryFn: () => api.get<Me[]>('/v1/admin/recentAccountsReport', { k: 64 }),
  })

  const customers = useQuery({
    queryKey: queryKeys.adminCustomers,
    queryFn: () => api.get<Me[]>('/v1/admin/customersReport', { k: 64 }),
  })

  const switchAccount = async () => {
    setSwitching(true)
    try {
      await api.post('/v1/admin/updateAccountId', { account_id: Number(accountId) })
      await queryClient.invalidateQueries()
      toast.success(`Now viewing account ${accountId}`)
    } catch {
      toast.error('Could not switch account.')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-black/5 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <Logo />
          <Wordmark />
          <Badge variant="warning" className="ml-1">
            Internal
          </Badge>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="account-id" className="text-[12px]">
              Switch account
            </Label>
            <Input
              id="account-id"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="Account id"
              className="mt-1 h-8 w-[140px]"
            />
          </div>
          <Button size="sm" onClick={switchAccount} disabled={!accountId || switching}>
            {switching && <Loader2 className="animate-spin" />}
            Switch
          </Button>
        </div>
      </header>

      <main className="px-5 py-6">
        <Tabs defaultValue="recent">
          <TabsList className="mb-4">
            <TabsTrigger value="recent">Recent accounts</TabsTrigger>
            <TabsTrigger value="customers">Paying customers</TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            <AccountTable rows={recent.data} isLoading={recent.isLoading} onSelect={setAccountId} />
          </TabsContent>

          <TabsContent value="customers">
            <AccountTable
              rows={customers.data}
              isLoading={customers.isLoading}
              onSelect={setAccountId}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function AccountTable({
  rows,
  isLoading,
  onSelect,
}: {
  rows: Me[] | undefined
  isLoading: boolean
  onSelect: (id: string) => void
}) {
  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div className="overflow-x-auto rounded-[8px] border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[80px]">ID</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="w-[110px] text-right">Users</TableHead>
            <TableHead className="w-[180px]">Integrations</TableHead>
            <TableHead className="w-[150px]">Explore status</TableHead>
            <TableHead className="w-[120px]">Billing</TableHead>
            <TableHead className="w-[120px]">First user</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rows ?? []).map((user) => {
            const team = user.team
            if (!team) return null

            const integrations = team.activeIntegrations.map((entry) => entry.name).join(', ')

            return (
              <TableRow key={team.id} className="cursor-pointer" onClick={() => onSelect(team.id)}>
                <TableCell className="font-mono text-[12px] text-gray-500">{team.id}</TableCell>
                <TableCell>
                  <span className="block font-medium text-gray-950">{team.name}</span>
                  <span className="block text-[12px] text-gray-400">{user.email}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{team.num_users}</TableCell>
                <TableCell className="text-gray-500">{integrations || '—'}</TableCell>
                <TableCell className="text-gray-500">{team.explore_status}</TableCell>
                <TableCell>
                  {team.billing_status.provisioned_by === '' ? (
                    <Badge variant="neutral">None</Badge>
                  ) : team.billing_status.provisioned_by === 'trial' ? (
                    <Badge variant="warning">
                      Trial · {team.billing_status.free_trial_remaining_days}d
                    </Badge>
                  ) : (
                    <Badge variant="success">{team.billing_status.provisioned_by}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-gray-500">{formatDay(user.created_at)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
