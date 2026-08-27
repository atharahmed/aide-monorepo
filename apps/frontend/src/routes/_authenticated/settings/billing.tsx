import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageBody, PageHeader } from '@/components/page-header'
import { InlineBar } from '@/components/data-viz'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SettingsTabs } from '@/features/settings/settings-tabs'
import { useMe, usePricingQuote } from '@/lib/queries'
import { formatCount, formatCurrency, formatDay } from '@/lib/format'

export const Route = createFileRoute('/_authenticated/settings/billing')({
  component: BillingSettingsPage,
})

const PLANS = [
  {
    slug: 'essentials',
    name: 'Essentials',
    price: '$99',
    cadence: '/month',
    priceId: 'price_essentials_monthly',
    blurb: 'Topics and drafts for a small team.',
    limit: 1_000,
    features: ['Topic detection', 'AI drafts', 'One helpdesk', 'Email support'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: '$249',
    cadence: '/month',
    priceId: 'price_pro_monthly',
    blurb: 'Scenarios and automations on top.',
    limit: 5_000,
    features: [
      'Everything in Essentials',
      'Scenarios',
      'Macros',
      'E-commerce data',
      'Shared Slack channel',
    ],
    recommended: true,
  },
  {
    slug: 'pro_plus',
    name: 'Pro Plus',
    price: '$599',
    cadence: '/month',
    priceId: 'price_pro_plus_monthly',
    blurb: 'Deployed agents answering on their own.',
    limit: 20_000,
    features: ['Everything in Pro', 'AI agents', 'Website + helpdesk channels', 'Priority support'],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    priceId: '',
    blurb: 'Volume pricing, SSO and a contract.',
    limit: Number.POSITIVE_INFINITY,
    features: [
      'Everything in Pro Plus',
      'SSO / SAML',
      'Custom data retention',
      'Dedicated support',
    ],
  },
]

function BillingSettingsPage() {
  const { data: user } = useMe()
  const { data: quote, isLoading } = usePricingQuote()
  const [pending, setPending] = useState<string>()

  const billing = user?.team?.billing_status
  const isShopify = billing?.provisioned_by === 'shopify'

  const onTrial = billing?.provisioned_by === 'trial'
  /* A trial has no plan, even though Stripe still reports a price id. */
  const currentPlan = onTrial
    ? undefined
    : PLANS.find((plan) => plan.priceId === billing?.latest_invoice_price_id)
  /* The quote is a mean of the busiest months, so it arrives fractional. */
  const monthlyVolume = Math.round(quote?.count ?? 0)

  const startCheckout = async (priceId: string) => {
    setPending(priceId)
    try {
      const result = await api.post<{ url: string }>('/v1/integrations/stripe/billing-redirect', {
        price_id: priceId,
      })
      window.location.href = result.url
    } catch {
      toast.error('Could not open checkout. Try again.')
      setPending(undefined)
    }
  }

  const openPortal = async () => {
    setPending('portal')
    try {
      const result = await api.post<{ url: string }>('/v1/integrations/stripe/portal-redirect')
      window.location.href = result.url
    } catch {
      toast.error('Could not open the billing portal. Try again.')
      setPending(undefined)
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your plan, usage and invoices."
        tabs={<SettingsTabs />}
        actions={
          billing?.stripe_customer_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={openPortal}
              disabled={pending === 'portal'}
            >
              {pending === 'portal' ? <Loader2 className="animate-spin" /> : <ExternalLink />}
              Manage billing
            </Button>
          )
        }
      />

      <PageBody className="flex flex-col gap-8">
        {/* Current state */}
        <section className="rounded-[8px] border border-black/5 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-gray-950">
                  {currentPlan?.name ?? (onTrial ? 'Free trial' : 'No plan')}
                </h2>
                {onTrial ? (
                  <Badge variant="warning">{billing.free_trial_remaining_days} days left</Badge>
                ) : billing?.latest_invoice_failed ? (
                  <Badge variant="destructive">Payment failed</Badge>
                ) : billing?.provisioned ? (
                  <Badge variant="success">
                    <StatusDot />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="neutral">Inactive</Badge>
                )}
              </div>
              <p className="mt-1 text-[13px] text-gray-500">
                {isShopify
                  ? 'Billed through Shopify. Manage the subscription from your Shopify admin.'
                  : onTrial
                    ? 'Every feature is unlocked during the trial. Choose a plan before it ends to keep going.'
                    : 'Billed monthly. Cancel or change plan at any time.'}
              </p>
            </div>

            {!isLoading && (
              <div className="min-w-[220px]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] text-gray-500">Conversations per month</span>
                  <span className="text-[15px] font-medium text-gray-950 tabular-nums">
                    {formatCount(monthlyVolume)}
                  </span>
                </div>
                <InlineBar
                  className="mt-2"
                  value={monthlyVolume}
                  max={
                    currentPlan && Number.isFinite(currentPlan.limit) ? currentPlan.limit : 5_000
                  }
                />
                <p className="mt-1.5 text-[12px] text-gray-400">
                  Average of your three busiest months
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Plans */}
        <section>
          <h2 className="mb-3 text-[17px] font-medium text-gray-950">Plans</h2>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan?.slug === plan.slug
              const fits = monthlyVolume <= plan.limit

              return (
                <div
                  key={plan.slug}
                  className={cn(
                    'flex flex-col rounded-[8px] border bg-white p-4',
                    isCurrent ? 'border-gray-950' : 'border-black/5'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13.5px] font-medium text-gray-950">{plan.name}</h3>
                    {isCurrent && <Badge variant="solid">Current</Badge>}
                    {!isCurrent && fits && plan.recommended && (
                      <Badge variant="neutral">Fits your volume</Badge>
                    )}
                  </div>

                  <p className="mt-2 flex items-baseline gap-1">
                    <span className="text-[22px] leading-none font-semibold tracking-[-0.03em] text-gray-950">
                      {plan.price}
                    </span>
                    <span className="text-[12.5px] text-gray-400">{plan.cadence}</span>
                  </p>

                  <p className="mt-2 text-[12.5px] leading-relaxed text-gray-500">{plan.blurb}</p>

                  <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-1.5 text-[12.5px] text-gray-600"
                      >
                        <Check className="mt-0.5 size-3 shrink-0 text-gray-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    {plan.priceId ? (
                      <Button
                        variant={isCurrent ? 'outline' : plan.recommended ? 'default' : 'outline'}
                        size="sm"
                        className="w-full"
                        disabled={isCurrent || isShopify || pending === plan.priceId}
                        onClick={() => startCheckout(plan.priceId)}
                      >
                        {pending === plan.priceId && <Loader2 className="animate-spin" />}
                        {isCurrent ? 'Current plan' : `Choose ${plan.name}`}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <a href="mailto:sales@aide.app">Talk to sales</a>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <Separator />

        {/* Invoices */}
        <section>
          <h2 className="mb-3 text-[17px] font-medium text-gray-950">Invoices</h2>

          {isLoading ? (
            <Skeleton className="h-32" />
          ) : (billing?.invoices ?? []).length === 0 ? (
            <p className="text-[13px] text-gray-500">No invoices yet.</p>
          ) : (
            <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(billing?.invoices ?? []).map((invoice) => (
                    <TableRow key={invoice.created_at}>
                      <TableCell>{formatDay(new Date(invoice.created_at))}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(invoice.amount_due)}
                      </TableCell>
                      <TableCell>
                        {invoice.succeeded ? (
                          <Badge variant="success">Paid</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </PageBody>
    </>
  )
}
