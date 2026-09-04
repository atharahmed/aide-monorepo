import { useState } from 'react'
import { Link, createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { isAuthenticated, writeToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, FormAlert, FormError, GoogleButton } from '@/features/auth/auth-shell'
import { inviteQueryOptions } from '@/lib/queries'
import type { LoginResponse } from '@/types/api'
import { searchString } from '@/lib/search'

export const Route = createFileRoute('/_auth/register')({
  /** `code` is set when arriving from an invite link. */
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: searchString(search.code),
  }),
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: '/home' })
  },
  loaderDeps: ({ search }) => ({ code: search.code }),
  /* Resolve the invite before the form renders, so the fields never flip from
   * blank signup to invited signup under the user. */
  loader: ({ context, deps }) =>
    deps.code ? context.queryClient.ensureQueryData(inviteQueryOptions(deps.code)) : null,
  errorComponent: InviteError,
  component: RegisterPage,
})

function InviteError({ error }: { error: Error }) {
  const router = useRouter()
  const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500

  return (
    <AuthShell
      title={rejected ? 'This invite is no longer valid' : 'We could not check that invite'}
      description={
        rejected
          ? 'It may have expired or already been used. Ask a teammate to send a new one.'
          : 'Something went wrong on our end. Try again in a moment.'
      }
      footer={
        <Link to="/login" className="text-gray-800 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {rejected ? (
        <Button variant="outline" className="w-full" asChild>
          <a href="mailto:support@aide.app">Contact support</a>
        </Button>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => router.invalidate()}>
          Try again
        </Button>
      )}
    </AuthShell>
  )
}

function RegisterPage() {
  const { code } = Route.useSearch()
  const invite = Route.useLoaderData()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setFieldErrors({})
    setPending(true)

    try {
      const result = await api.post<LoginResponse>('/v1/register', {
        name,
        email: invite?.email ?? email,
        password,
        invite_code: code,
      })
      writeToken(result.token)
      navigate({ to: invite ? '/home' : '/start' })
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors)
        setError(Object.keys(caught.fieldErrors).length ? undefined : caught.displayMessage)
      } else {
        setError('Could not create your account. Try again.')
      }
      setPending(false)
    }
  }

  return (
    <AuthShell
      title={invite ? `Join ${invite.team_name}` : 'Create your account'}
      description={
        invite ? `${invite.invited_by} invited you.` : 'Get started with Google or email'
      }
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-gray-800 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <FormAlert>{error}</FormAlert>

      <GoogleButton invite={code} />

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            aria-invalid={Boolean(fieldErrors.name)}
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5"
            placeholder="Julia Marten"
          />
          <FormError>{fieldErrors.name}</FormError>
        </div>

        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            aria-invalid={Boolean(fieldErrors.email)}
            type="email"
            required
            autoComplete="email"
            readOnly={Boolean(invite)}
            value={invite?.email ?? email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5"
            placeholder="you@company.com"
          />
          <FormError>{fieldErrors.email}</FormError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            aria-invalid={Boolean(fieldErrors.password)}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5"
            placeholder="At least 8 characters"
          />
          <FormError>{fieldErrors.password}</FormError>
        </div>

        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full rounded-[8px]">
          {pending && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
