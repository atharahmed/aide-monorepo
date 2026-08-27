import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { PageBody, PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SettingsTabs } from '@/features/settings/settings-tabs'
import { FormError } from '@/features/auth/auth-shell'
import { useMe, useUpdateAccount } from '@/lib/queries'

export const Route = createFileRoute('/_authenticated/settings/account')({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const { data: user } = useMe()
  const updateAccount = useUpdateAccount()

  const [name, setName] = useState(user?.name ?? '')
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const nameDirty = name !== (user?.name ?? '')
  const passwordMismatch = confirmation.length > 0 && password !== confirmation

  const saveName = () =>
    updateAccount.mutate({ name }, { onSuccess: () => toast.success('Profile updated') })

  const savePassword = () => {
    setErrors({})
    updateAccount.mutate(
      {
        name: user?.name ?? name,
        old_password: oldPassword,
        password,
        password_confirmation: confirmation,
      },
      {
        onSuccess: () => {
          setOldPassword('')
          setPassword('')
          setConfirmation('')
          toast.success('Password updated')
        },
        onError: (error) => {
          if (error instanceof ApiError) setErrors(error.fieldErrors)
          else toast.error('Could not update your password.')
        },
      }
    )
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile and sign-in details."
        tabs={<SettingsTabs />}
      />

      <PageBody className="max-w-xl">
        <section>
          <h2 className="text-[19px] font-medium text-gray-950">Profile</h2>

          <div className="mt-3 flex flex-col gap-3.5">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ''} readOnly disabled className="mt-1.5" />
              <p className="mt-1.5 text-[12px] text-gray-400">
                Contact support to change the email on your account.
              </p>
            </div>

            <Button
              size="sm"
              className="self-start"
              disabled={!nameDirty || updateAccount.isPending}
              onClick={saveName}
            >
              {updateAccount.isPending && <Loader2 className="animate-spin" />}
              Save profile
            </Button>
          </div>
        </section>

        <Separator className="my-7" />

        <section>
          <h2 className="text-[19px] font-medium text-gray-950">Password</h2>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Changing your password signs you out of the Front and Zendesk panels.
          </p>

          <div className="mt-3 flex flex-col gap-3.5">
            <div>
              <Label htmlFor="old-password">Current password</Label>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                className="mt-1.5"
              />
              <FormError>{errors.old_password}</FormError>
            </div>

            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5"
              />
              <FormError>{errors.password}</FormError>
            </div>

            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                aria-invalid={passwordMismatch}
                className="mt-1.5"
              />
              <FormError>
                {passwordMismatch ? 'The two passwords do not match.' : undefined}
              </FormError>
            </div>

            <Button
              size="sm"
              className="self-start"
              disabled={
                !oldPassword || password.length < 8 || passwordMismatch || updateAccount.isPending
              }
              onClick={savePassword}
            >
              {updateAccount.isPending && <Loader2 className="animate-spin" />}
              Update password
            </Button>
          </div>
        </section>
      </PageBody>
    </>
  )
}
