import { Link, useRouterState } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const tabs = [
  { value: 'account', label: 'Account', to: '/settings/account' },
  { value: 'notifications', label: 'Notifications', to: '/settings/notifications' },
  { value: 'billing', label: 'Billing', to: '/settings/billing' },
  { value: 'agent-panel', label: 'Agent panel', to: '/settings/agent-panel' },
] as const

export function SettingsTabs() {
  const { location } = useRouterState()
  const active = tabs.find((tab) => location.pathname.startsWith(tab.to))?.value ?? 'account'

  return (
    <Tabs value={active}>
      <TabsList className="mb-0">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} asChild>
            <Link to={tab.to}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
