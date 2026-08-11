import { http, HttpResponse } from 'msw'
import { db } from '../db'
import { latency } from '../utils'

const V1 = '*/v1'

const COMPANIES = [
  'Northwind Outdoors',
  'Harbour & Vine',
  'Kestrel Cycles',
  'Fernway Coffee',
  'Atlas Bindery',
  'Pilot Light Studio',
  'Mossgrove Botanicals',
  'Salt & Sail',
  'Ironwood Tools',
  'Verity Optics',
  'Lantern Press',
  'Bluepeak Nutrition',
]

function accountRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: 4800 + index,
    name: COMPANIES[index % COMPANIES.length] + (index >= COMPANIES.length ? ` ${index}` : ''),
    website: `https://${COMPANIES[index % COMPANIES.length].toLowerCase().replace(/[^a-z]/g, '')}.com`,
    created_at: new Date(Date.now() - index * 3 * 86_400_000).toISOString(),
    num_users: 1 + ((index * 3) % 9),
    ticket_count: 120 + index * 137,
    explore_status: (['READY', 'IMPORTING_DATA', 'CRUNCHING_DATA', 'NOT_ENOUGH_DATA'] as const)[
      index % 4
    ],
    provisioned_by: (['stripe', 'trial', '', 'shopify'] as const)[index % 4],
  }))
}

export const adminHandlers = [
  http.get(`${V1}/admin/recentAccountsReport`, async ({ request }) => {
    await latency()
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('k')) || 64
    return HttpResponse.json(accountRows(Math.min(limit, 24)))
  }),

  http.get(`${V1}/admin/customersReport`, async () => {
    await latency()
    return HttpResponse.json(accountRows(12).filter((account) => account.provisioned_by !== ''))
  }),

  http.post(`${V1}/admin/updateAccountId`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { accountId: number }
    if (db.me.team) db.me.team.id = body.accountId
    return HttpResponse.json({ success: true, account_id: body.accountId })
  }),
]
