import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/components/page-header'
import { ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { useFrontInboxes, useSaveFrontInboxes } from '@/lib/queries'

export const Route = createFileRoute('/_authenticated/integrations/front/inboxes')({
  component: FrontInboxesPage,
})

function FrontInboxesPage() {
  const { data: inboxes, isLoading, isError, refetch } = useFrontInboxes()
  const saveInboxes = useSaveFrontInboxes()

  const [enabled, setEnabled] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!inboxes) return
    setEnabled(
      Object.fromEntries(inboxes.map((inbox) => [inbox.id, inbox.is_enabled])) as Record<
        number,
        boolean
      >
    )
  }, [inboxes])

  const dirty = (inboxes ?? []).some((inbox) => enabled[inbox.id] !== inbox.is_enabled)
  const enabledCount = Object.values(enabled).filter(Boolean).length

  return (
    <>
      <PageHeader
        title="Front inboxes"
        description="Aide only reads the inboxes you switch on here."
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/integrations/$slug" params={{ slug: 'front' }}>
                <ArrowLeft />
                Back to Front
              </Link>
            </Button>
            <Button
              size="sm"
              disabled={!dirty || saveInboxes.isPending}
              onClick={() =>
                saveInboxes.mutate(
                  Object.entries(enabled).map(([id, isEnabled]) => ({
                    id: Number(id),
                    is_enabled: isEnabled,
                  })),
                  { onSuccess: () => toast.success('Inboxes updated') }
                )
              }
            >
              {saveInboxes.isPending && <Loader2 className="animate-spin" />}
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </>
        }
      />

      <PageBody className="max-w-2xl">
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : isError ? (
          <ErrorState
            title="Could not load your Front inboxes"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : (
          <>
            <div className="divide-y divide-gray-200 overflow-hidden rounded-[8px] border border-black/5 bg-white">
              {(inboxes ?? []).map((inbox) => (
                <label
                  key={inbox.id}
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-gray-950">
                      {inbox.name}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-gray-500">
                      {enabled[inbox.id]
                        ? inbox.is_pulled
                          ? 'Syncing'
                          : 'Will start syncing when you save'
                        : 'Not synced'}
                    </span>
                  </span>
                  <Switch
                    checked={enabled[inbox.id] ?? false}
                    onCheckedChange={(checked) =>
                      setEnabled((current) => ({ ...current, [inbox.id]: checked }))
                    }
                    aria-label={`Sync the ${inbox.name} inbox`}
                  />
                </label>
              ))}
            </div>

            <p className="mt-3 text-[12.5px] text-gray-400">
              {enabledCount} of {(inboxes ?? []).length} inboxes enabled. Turning one on imports its
              recent history, which takes a few minutes.
            </p>
          </>
        )}
      </PageBody>
    </>
  )
}
