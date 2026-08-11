import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/` has always landed on Home. */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/home' })
  },
})
