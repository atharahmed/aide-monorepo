import { http, HttpResponse } from 'msw'
import { db, nextId, refreshMeFlags } from '../db'
import { latency } from '../utils'

const V1 = '*/v1'

export const integrationHandlers = [
  http.get(`${V1}/integrations`, async () => {
    await latency()
    return HttpResponse.json(db.me.team?.activeIntegrations ?? [])
  }),

  /** Step 1 of OAuth — the backend hands back the provider's consent URL. */
  http.post(`${V1}/integrations/:slug`, async ({ params, request }) => {
    await latency()
    const slug = String(params.slug)
    const body = (await request.json().catch(() => ({}))) as Record<string, string>
    const state = Math.random().toString(36).slice(2, 10)
    const subdomain = body.subdomain || body.account || body.domain || 'demo'

    /* Loop straight back to the app so the demo can walk the whole flow
     * without leaving the tab. */
    const redirect = `${window.location.origin}/auth/${slug}?code=demo_${state}&state=${state}`

    return HttpResponse.json({
      url: redirect,
      provider_url: `https://${subdomain}.${slug}.com/oauth/authorize?state=${state}`,
    })
  }),

  http.post(`${V1}/integrations/:slug/connect`, async ({ params }) => {
    await latency()
    const slug = String(params.slug)
    const team = db.me.team
    if (team && !team.activeIntegrations.some((integration) => integration.name === slug)) {
      team.activeIntegrations.push({
        id: nextId(),
        name: slug,
        uuid: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        meta_data: {},
      })
      refreshMeFlags()
    }
    return HttpResponse.json({ success: true, name: slug })
  }),

  http.post(`${V1}/integrations/woocommerce/confirm`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V1}/integrations/:name/tag_sync`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  /* Billing ------------------------------------------------------------- */

  http.post(`${V1}/integrations/stripe/billing-redirect`, async ({ request }) => {
    await latency()
    const body = (await request.json().catch(() => ({}))) as { price_id?: string }
    return HttpResponse.json({
      url: `https://checkout.stripe.com/c/pay/demo#${body.price_id ?? 'price_pro_monthly'}`,
    })
  }),

  http.post(`${V1}/integrations/stripe/portal-redirect`, async () => {
    await latency()
    return HttpResponse.json({ url: 'https://billing.stripe.com/p/session/demo' })
  }),
]
