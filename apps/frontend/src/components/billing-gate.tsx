import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { BillingState } from '@/features/onboarding/actions'

/** Non-blocking strip for the trial countdown. */
export function BillingBanner({ state }: { state: BillingState }) {
  if (state.blocking) return null

  return (
    <Link
      to="/settings/billing"
      className="group flex items-center justify-center gap-1.5 bg-warning-50 px-4 py-2 text-[12.5px] font-medium text-warning-800 transition-colors hover:bg-warning-100"
    >
      {state.content}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

/** Service-paused modal — dismissal is deliberately not offered. */
export function BillingLockModal({ state }: { state: BillingState }) {
  if (!state.blocking) return null

  return (
    <Dialog open>
      <DialogContent showClose={false} className="max-w-md">
        <DialogTitle>Service paused</DialogTitle>
        <DialogDescription>{state.content}</DialogDescription>
        <p className="text-[13px] leading-relaxed text-gray-500">
          Your conversations, topics and scenarios are all still here. Nothing is deleted while
          billing is paused.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" asChild>
            <a href="mailto:support@aide.app">Contact support</a>
          </Button>
          <Button asChild>
            <Link to="/settings/billing">Go to billing</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
