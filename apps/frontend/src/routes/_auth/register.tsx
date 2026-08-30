import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { writeToken } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, FormAlert, FormError, GoogleButton } from '@/features/auth/auth-shell'
import { useInviteDetails } from '@/lib/queries'
import type { LoginResponse } from '@/types/api'
import { searchString } from '@/lib/search'

export const Route = createFileRoute('/_auth/register')({
  /** `invite` is set when arriving from an invite link. */
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite: searchString(search.invite),
  }),
  component: RegisterPage,
})

function RegisterPage() {
  const { invite } = Route.useSearch()
  const navigate = useNavigate()
  const inviteQuery = useInviteDetails(invite ?? '')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const invitedEmail = inviteQuery.data?.email

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setFieldErrors({})
    setPending(true)

    try {
      const result = await api.post<LoginResponse>('/v1/register', {
        name,
        email: invitedEmail ?? email,
        password,
        invite_code: invite,
      })
      writeToken(result.token)
      navigate({ to: '/start' })
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
      title={inviteQuery.data ? `Join ${inviteQuery.data.team_name}` : 'Create your account'}
      description={
        inviteQuery.data
          ? `${inviteQuery.data.invited_by} invited you.`
          : 'Get started with Google or email'
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

      <GoogleButton invite={invite} />

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
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
            type="email"
            required
            autoComplete="email"
            readOnly={Boolean(invitedEmail)}
            value={invitedEmail ?? email}
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
