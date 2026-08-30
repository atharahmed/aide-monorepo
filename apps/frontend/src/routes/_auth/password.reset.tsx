import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, FormAlert, FormError } from '@/features/auth/auth-shell'
import { toast } from 'sonner'
import { searchString } from '@/lib/search'

export const Route = createFileRoute('/_auth/password/reset')({
  validateSearch: (search: Record<string, unknown>): { token?: string; email?: string } => ({
    token: searchString(search.token) ?? '',
    email: searchString(search.email) ?? '',
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token = '', email = '' } = Route.useSearch()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const mismatch = confirmation.length > 0 && password !== confirmation

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (mismatch) return

    setError(undefined)
    setPending(true)
    try {
      await api.post('/v1/password/reset', {
        token,
        email,
        password,
        password_confirmation: confirmation,
      })
      toast.success('Password updated. Sign in with your new password.')
      navigate({ to: '/login' })
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.displayMessage : 'Could not update your password.'
      )
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      description={email ? `For ${email}.` : 'Choose a password of at least 8 characters.'}
      footer={
        <Link to="/login" className="text-gray-800 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <FormAlert>{error}</FormAlert>

        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="confirmation">Confirm password</Label>
          <Input
            id="confirmation"
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-invalid={mismatch}
            className="mt-1.5"
          />
          <FormError>{mismatch ? 'The two passwords do not match.' : undefined}</FormError>
        </div>

        <Button type="submit" size="lg" disabled={pending || mismatch} className="w-full rounded-[8px]">
          {pending && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
