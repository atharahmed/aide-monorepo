import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell, FormAlert } from '@/features/auth/auth-shell'

export const Route = createFileRoute('/_auth/password/forgot')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(undefined)
    setPending(true)
    try {
      await api.post('/v1/password/email', { email })
      setSent(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.displayMessage : 'Could not send the email.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Forgot password?"
      description={
        sent
          ? undefined
          : 'Enter the email on your account and we will send you a reset link.'
      }
      footer={
        <Link to="/login" className="text-gray-800 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-2.5 rounded-[8px] border border-success-200 bg-success-50 px-3 py-2.5">
          <CheckCircle2 className="mt-px size-4 shrink-0 text-success-600" />
          <p className="text-[13px] leading-relaxed text-success-800">
            If an account exists for <span className="font-medium">{email}</span>, the reset link is
            on its way. It expires in one hour.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <FormAlert>{error}</FormAlert>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5"
              placeholder="you@company.com"
            />
          </div>
          <Button type="submit" size="lg" disabled={pending} className="w-full rounded-[8px]">
            {pending && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
