import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/settings` has always meant the account tab. */
export const Route = createFileRoute('/_authenticated/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/account' })
  },
})
