import { http, HttpResponse } from 'msw'
import { db } from '../db'
import { latency } from '../utils'

const API = '*/v1'

/** Any credentials work in the demo — the point is to show the flow. */
export const authHandlers = [
  http.post(`${API}/login`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { email?: string; password?: string }
    if (!body?.email || !body?.password) {
      return HttpResponse.json(
        { errors: [{ field: 'email', message: 'Enter your email and password' }] },
        { status: 422 }
      )
    }
    if (body.email === 'locked@example.com') {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 400 })
    }
    db.me.email = body.email
    return HttpResponse.json({ type: 'bearer', token: 'demo-token-' + Date.now() })
  }),

  http.post(`${API}/register`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { name?: string; email?: string }
    if (body?.name) db.me.name = body.name
    if (body?.email) db.me.email = body.email
    if (db.me.team) db.me.team.show_onboarding = true
    return HttpResponse.json({ type: 'bearer', token: 'demo-token-' + Date.now() })
  }),

  http.post(`${API}/password/email`, async () => {
    await latency()
    return HttpResponse.json({ success: true, message: 'Reset link sent' })
  }),

  http.post(`${API}/password/reset`, async () => {
    await latency()
    return HttpResponse.json({ success: true, message: 'Password updated' })
  }),

  http.post(`${API}/logout`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.get(`${API}/team/invite/:code`, async ({ params }) => {
    await latency()
    if (params.code === 'expired') {
      return HttpResponse.json({ message: 'Invite code expired' }, { status: 422 })
    }
    return HttpResponse.json({
      email: 'kai@northwindoutdoors.com',
      invited_by: `${db.me.name} (${db.me.email})`,
      invite_code: String(params.code),
      team_name: db.me.team?.name ?? '',
    })
  }),

  http.get('*/v1/auth/google/redirect', async () =>
    HttpResponse.json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?demo=1' })
  ),
]
