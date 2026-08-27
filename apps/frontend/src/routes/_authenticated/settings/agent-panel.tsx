import { createFileRoute } from '@tanstack/react-router'
import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { SettingsTabs } from '@/features/settings/settings-tabs'
import { useMacros, useMe, useUpdateWidgetSettings } from '@/lib/queries'
import type { WidgetSettingName } from '@/types/api'

export const Route = createFileRoute('/_authenticated/settings/agent-panel')({
  component: AgentPanelSettingsPage,
})

const FEATURES: Array<{ name: WidgetSettingName; label: string; description: string }> = [
  {
    name: 'ai_response',
    label: 'AI drafts',
    description: 'Show a suggested reply your team can edit before sending.',
  },
  {
    name: 'intent_feedback',
    label: 'Topic feedback',
    description: 'Let agents mark a detected topic as right or wrong from the panel.',
  },
  {
    name: 'draft_feedback',
    label: 'Draft feedback',
    description: 'Let agents rate each draft. This is what improves the answers over time.',
  },
  {
    name: 'macros',
    label: 'Macro suggestions',
    description: 'Suggest the macro that usually follows this kind of conversation.',
  },
]

function AgentPanelSettingsPage() {
  const { data: user, isLoading } = useMe()
  const { data: macros } = useMacros()
  const updateSettings = useUpdateWidgetSettings()

  const settings = user?.widget_settings?.settings ?? []
  const isOn = (name: WidgetSettingName) =>
    settings.find((setting) => setting.name === name)?.active ?? false

  const toggle = (name: WidgetSettingName, active: boolean) => {
    const next = FEATURES.map((feature) => ({
      name: feature.name,
      active: feature.name === name ? active : isOn(feature.name),
    }))
    updateSettings.mutate(next, {
      onSuccess: () => toast.success('Agent panel updated'),
      onError: () => toast.error('Could not save that change.'),
    })
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="What your team sees in the Aide panel inside Front and Zendesk."
        tabs={<SettingsTabs />}
      />

      <PageBody className="grid max-w-4xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <h2 className="mb-3 text-[19px] font-medium text-gray-950">Panel features</h2>

          {isLoading ? (
            <Skeleton className="h-56" />
          ) : (
            <div className="divide-y divide-gray-200 overflow-hidden rounded-[8px] border border-black/5 bg-white">
              {FEATURES.map((feature) => (
                <div key={feature.name} className="flex items-start gap-4 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={feature.name}>{feature.label}</Label>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                      {feature.description}
                    </p>
                    {feature.name === 'macros' && (
                      <p className="mt-1 text-[12px] text-gray-400">
                        {(macros ?? []).length} macro{(macros ?? []).length === 1 ? '' : 's'}{' '}
                        available
                      </p>
                    )}
                  </div>
                  <Switch
                    id={feature.name}
                    className="mt-1"
                    checked={isOn(feature.name)}
                    onCheckedChange={(checked) => toggle(feature.name, checked)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <aside>
          <h2 className="mb-3 text-[19px] font-medium text-gray-950">Preview</h2>

          <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white">
            <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
              <Sparkles className="size-3.5 text-gray-400" />
              <span className="text-[12.5px] font-medium text-gray-950">Aide</span>
            </div>

            <div className="flex flex-col gap-3 p-3">
              {isOn('intent_feedback') && (
                <div>
                  <p className="mb-1.5 font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
                    Topic
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 py-1 pr-1.5 pl-2.5">
                    <span className="text-[12px]">📦</span>
                    <span className="text-[12px] font-medium text-gray-950">Order status</span>
                    <ThumbsUp className="size-3 text-gray-300" />
                    <ThumbsDown className="size-3 text-gray-300" />
                  </span>
                </div>
              )}

              {isOn('ai_response') && (
                <div>
                  <p className="mb-1.5 font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
                    Draft
                  </p>
                  <div className="rounded-[6px] border border-black/5 px-2.5 py-2 text-[12px] leading-relaxed text-gray-700">
                    Thanks for getting in touch — your order left the warehouse on Monday and is due
                    Thursday.
                  </div>
                  {isOn('draft_feedback') && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <ThumbsUp className="size-3 text-gray-300" />
                      <ThumbsDown className="size-3 text-gray-300" />
                      <span className="text-[11px] text-gray-400">Rate this draft</span>
                    </div>
                  )}
                </div>
              )}

              {isOn('macros') && (
                <div>
                  <p className="mb-1.5 font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
                    Suggested macro
                  </p>
                  <Badge variant="neutral">{macros?.[0]?.name ?? 'Send return label'}</Badge>
                </div>
              )}

              {!isOn('intent_feedback') && !isOn('ai_response') && !isOn('macros') && (
                <p className="py-6 text-center text-[12.5px] text-gray-400">
                  Every feature is off — the panel would be empty.
                </p>
              )}
            </div>
          </div>
        </aside>
      </PageBody>
    </>
  )
}
