import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/lib/auth'
import { parseWidgetSource, type WidgetSource } from '@/features/auth/widget-handoff'
import { searchString } from '@/lib/search'

export const Route = createFileRoute('/_auth/join')({
  validateSearch: (
    search: Record<string, unknown>
  ): { code?: string; source?: WidgetSource; originOverride?: string } => ({
    code: searchString(search.code),
    source: parseWidgetSource(search.source),
    originOverride: searchString(search.originOverride),
  }),
  beforeLoad: ({ search }) => {
    /* Reached from a helpdesk panel with a session already in hand: skip
     * straight to the token handoff rather than re-accepting an invite. */
    if (isAuthenticated()) {
      if (search.source) {
        throw redirect({
          to: '/login/widget',
          search: { source: search.source, originOverride: search.originOverride },
        })
      }

      throw redirect({ to: '/home' })
    }

    if (search.code) throw redirect({ to: '/register', search: { code: search.code } })

    throw redirect({ to: '/login' })
  },
})
