import { useEffect, useState } from 'react'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { isAuthenticated, writeToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthDivider, AuthShell, FormAlert, GoogleButton } from '@/features/auth/auth-shell'
import {
  notifyParentLoginRequired,
  parseWidgetSource,
  type WidgetSource,
} from '@/features/auth/widget-handoff'
import type { LoginResponse } from '@/types/api'
import { searchString } from '@/lib/search'

interface LoginSearch {
  next?: string
  /** Set when a helpdesk panel opened this page; the token goes back to it. */
  source?: WidgetSource
  /** Lets a panel on a non-standard origin name itself for the handoff. */
  originOverride?: string
}

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    next: searchString(search.next),
    source: parseWidgetSource(search.source),
    originOverride: searchString(search.originOverride),
  }),
  /* An existing session skips the form: a panel login goes straight to the
   * handoff, anything else lands where the user was headed. */
  beforeLoad: ({ search }) => {
    if (!isAuthenticated()) return

    if (search.source) {
      throw redirect({
        to: '/login/widget',
        search: { source: search.source, originOverride: search.originOverride },
      })
    }

    throw redirect({ to: search.next?.startsWith('/') ? search.next : '/home' })
  },
  component: LoginPage,
})

function LoginPage() {
  const { next, source, originOverride } = Route.useSearch()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  /* When a panel embeds this page it waits for this before opening its popup. */
  useEffect(notifyParentLoginRequired, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setPending(true)

    try {
      const result = await api.post<LoginResponse>('/v1/login', { email, password })
      writeToken(result.token)

      if (source) {
        navigate({ to: '/login/widget', search: { source, originOverride } })
        return
      }
      navigate({ to: next && next.startsWith('/') ? next : '/home' })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.displayMessage : 'Could not sign in. Try again.')
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Sign in "
      description={
        source
          ? `Sign in to connect the Aide panel to ${source[0].toUpperCase()}${source.slice(1)}.`
          : undefined
      }
      footer={
        <>
          New to Aide?{' '}
          <Link to="/register" className="font-medium text-gray-950 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <FormAlert>{error}</FormAlert>

      <GoogleButton label="Sign in with Google" />
      <AuthDivider />

      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/password/forgot"
              className="text-[12.5px] text-gray-500 hover:text-gray-950 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5"
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
