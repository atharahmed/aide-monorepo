import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { readToken } from '@/lib/auth'
import { AuthShell } from '@/features/auth/auth-shell'
import {
  parseWidgetSource,
  postWidgetToken,
  type WidgetSource,
} from '@/features/auth/widget-handoff'
import type { Me } from '@/types/api'
import { searchString } from '@/lib/search'

/**
 * Widget login handoff. The Front/Zendesk/WordPress panel opens this page in a
 * popup; we post the widget token back to the opener and close. The message
 * shape is fixed by the already-shipped panels — see `widget-handoff.ts`.
 */
export const Route = createFileRoute('/_auth/login_/widget')({
  validateSearch: (
    search: Record<string, unknown>
  ): { source: WidgetSource; originOverride?: string } => ({
    source: parseWidgetSource(search.source) ?? 'front',
    originOverride: searchString(search.originOverride),
  }),
  component: WidgetHandoff,
})

function WidgetHandoff() {
  const { source, originOverride } = Route.useSearch()
  const [status, setStatus] = useState<'working' | 'done' | 'failed'>('working')

  useEffect(() => {
    let cancelled = false

    const handoff = async () => {
      if (!readToken()) {
        setStatus('failed')
        return
      }

      try {
        const me = await api.get<Me>('/v1/me')
        if (cancelled) return

        if (!postWidgetToken(me.widget_token, source, originOverride)) {
          setStatus('failed')
          return
        }

        setStatus('done')
        /* The v5 page closed immediately. The short pause lets the user see
         * that it worked on the rare occasion the close is blocked. */
        window.setTimeout(() => window.close(), 800)
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }

    void handoff()
    return () => {
      cancelled = true
    }
  }, [source, originOverride])

  return (
    <AuthShell
      title={status === 'failed' ? 'Could not connect the panel' : 'Connecting the Aide panel'}
      description={
        status === 'failed'
          ? 'Sign in again from the panel and we will retry the handoff.'
          : `Handing your session to ${source}. This window closes on its own.`
      }
    >
      <div className="flex items-center gap-2 text-[13px] text-gray-600">
        {status === 'done' ? (
          <>
            <CheckCircle2 className="size-4 text-success-600" />
            Connected. You can close this window.
          </>
        ) : status === 'failed' ? (
          <span className="text-destructive-600">No active session found.</span>
        ) : (
          <>
            <Loader2 className="size-4 animate-spin text-gray-400" />
            Working…
          </>
        )}
      </div>
    </AuthShell>
  )
}
