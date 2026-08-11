import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { readToken } from '@/lib/auth'
import { AuthShell } from '@/features/auth/auth-shell'
import type { Me } from '@/types/api'

/**
 * Widget login handoff. The Front/Zendesk/WordPress panel opens this page in a
 * popup; we post the widget token back to the opener and close. The message
 * shape is fixed by the already-shipped panels — do not change it.
 */
export const Route = createFileRoute('/_auth/login_/widget')({
  validateSearch: (search: Record<string, unknown>): { source?: string } => ({
    source: typeof search.source === 'string' ? search.source : 'front',
  }),
  component: WidgetHandoff,
})

function WidgetHandoff() {
  const { source = 'front' } = Route.useSearch()
  const [status, setStatus] = useState<'working' | 'done' | 'failed'>('working')

  useEffect(() => {
    let cancelled = false

    const handoff = async () => {
      const token = readToken()
      if (!token) {
        setStatus('failed')
        return
      }

      try {
        const me = await api.get<Me>('/v1/me')
        if (cancelled) return

        window.opener?.postMessage(
          { type: 'aide:login', source, token, widgetToken: me.widget_token },
          '*'
        )
        setStatus('done')
        window.setTimeout(() => window.close(), 1200)
      } catch {
        if (!cancelled) setStatus('failed')
      }
    }

    void handoff()
    return () => {
      cancelled = true
    }
  }, [source])

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
