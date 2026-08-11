import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/components/page-header'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingsTabs } from '@/features/settings/settings-tabs'
import { useMe, useUpdateEmailPreferences } from '@/lib/queries'
import type { EmailPreferenceName } from '@/types/api'

export const Route = createFileRoute('/_authenticated/settings/notifications')({
  component: NotificationSettingsPage,
})

const PREFERENCES: Array<{ name: EmailPreferenceName; label: string; description: string }> = [
  {
    name: 'weekly_summary',
    label: 'Weekly summary',
    description: 'What Aide handled last week, and where it needed a human.',
  },
  {
    name: 'event_based',
    label: 'Activity alerts',
    description: 'When an import finishes, a scenario starts failing, or an agent goes offline.',
  },
  {
    name: 'onboarding_sequences',
    label: 'Setup tips',
    description: 'A short series on getting the most out of Aide. Stops on its own.',
  },
  {
    name: 'event_invitations',
    label: 'Event invitations',
    description: 'Webinars and office hours with the Aide team.',
  },
  {
    name: 'marketing',
    label: 'Product news',
    description: 'New features and changes worth knowing about.',
  },
]

function NotificationSettingsPage() {
  const { data: user, isLoading } = useMe()
  const updatePreferences = useUpdateEmailPreferences()

  const current = user?.email_preferences ?? {}

  const toggle = (name: EmailPreferenceName, active: boolean) => {
    const next = PREFERENCES.map((preference) => ({
      name: preference.name,
      active: preference.name === name ? active : Boolean(current[preference.name]),
    }))

    updatePreferences.mutate(next, {
      onSuccess: () => toast.success('Notification settings saved'),
      onError: () => toast.error('Could not save that change.'),
    })
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Which emails Aide sends you."
        tabs={<SettingsTabs />}
      />

      <PageBody className="max-w-xl">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="divide-y divide-gray-200 overflow-hidden rounded-[8px] border border-gray-200 bg-white">
            {PREFERENCES.map((preference) => (
              <div key={preference.name} className="flex items-start gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={preference.name}>{preference.label}</Label>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                    {preference.description}
                  </p>
                </div>
                <Switch
                  id={preference.name}
                  className="mt-1"
                  checked={Boolean(current[preference.name])}
                  onCheckedChange={(checked) => toggle(preference.name, checked)}
                />
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}
