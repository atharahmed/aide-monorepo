import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { writeToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthDivider, AuthShell, FormAlert, GoogleButton } from '@/features/auth/auth-shell'
import type { LoginResponse } from '@/types/api'

interface LoginSearch {
  next?: string
  /** Widget logins hand the token back to the host app instead of navigating. */
  source?: 'front' | 'zendesk' | 'wordpress'
}

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    next: typeof search.next === 'string' ? search.next : undefined,
    source:
      search.source === 'front' || search.source === 'zendesk' || search.source === 'wordpress'
        ? search.source
        : undefined,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { next, source } = Route.useSearch()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setPending(true)

    try {
      const result = await api.post<LoginResponse>('/v1/login', { email, password })
      writeToken(result.token)

      if (source) {
        navigate({ to: '/login/widget', search: { source } })
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
      title="Sign in to Aide"
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
