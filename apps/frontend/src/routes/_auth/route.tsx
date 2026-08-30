import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * Pathless grouping for the pages you can reach while signed out — login,
 * register, invite acceptance and password recovery. It adds no segment to the
 * URL; each page still brings its own `AuthShell` for the shared chrome.
 * It exists so anything common to the signed-out surface has one home.
 */
export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return <Outlet />
}
