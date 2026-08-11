import { http, HttpResponse } from 'msw'
import { db, nextId, refreshMeFlags } from '../db'
import { latency } from '../utils'
import type { EmailPreferenceName, WidgetSettingName } from '@/types/api'

const V1 = '*/v1'
const V2 = '*/v2'

export const userHandlers = [
  http.get(`${V1}/me`, async () => {
    await latency()
    refreshMeFlags()
    return HttpResponse.json(db.me)
  }),

  http.post(`${V1}/user`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      name?: string
      password?: string
      old_password?: string
    }
    if (body.password && body.old_password !== 'password') {
      return HttpResponse.json(
        { errors: { old_password: 'Current password is not valid' } },
        { status: 422 }
      )
    }
    if (body.name) {
      db.me.name = body.name
      db.me.initials = body.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
      const self = db.team.find((member) => member.id === db.me.id)
      if (self) {
        self.name = db.me.name
        self.initials = db.me.initials
      }
    }
    return HttpResponse.json({ success: true, response: 'Profile updated' })
  }),

  http.get(`${V1}/team`, async () => {
    await latency()
    return HttpResponse.json(db.team)
  }),

  http.post(`${V1}/team/invite`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { users: string[] }
    const taken: string[] = []
    let sent = 0

    for (const email of body.users) {
      if (db.team.some((member) => member.email === email)) {
        taken.push(email)
        continue
      }
      const id = nextId()
      db.team.push({
        id,
        name: '',
        initials: '',
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: false,
        invited: true,
        status: 'pending',
        invite_url: `https://app.aide.app/join?code=${id.toString(16)}${Date.now().toString(16)}`,
        last_seen_at: null,
      })
      sent++
    }

    refreshMeFlags()
    return HttpResponse.json({
      total_invites: body.users.length,
      invites_sent: sent,
      emails_taken: taken,
    })
  }),

  http.post(`${V1}/team/invite/resend`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { id: number }
    const invite = db.team.find((member) => member.id === body.id)
    if (invite) {
      invite.status = 'pending'
      invite.updated_at = new Date().toISOString()
    }
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${V1}/team/invite`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { id: number }
    db.team = db.team.filter((member) => member.id !== body.id)
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V2}/email-preferences`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      preferences: Array<{ name: EmailPreferenceName; active: boolean }>
    }
    const next: Partial<Record<EmailPreferenceName, boolean>> = {}
    for (const preference of body.preferences) next[preference.name] = preference.active
    db.me.email_preferences = next
    return HttpResponse.json({ success: true, email_preferences: next })
  }),

  http.post(`${V2}/ai-assist`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      settings: Array<{ name: WidgetSettingName; active: boolean }>
    }
    db.me.widget_settings = { settings: body.settings }
    return HttpResponse.json({ success: true, widget_settings: db.me.widget_settings })
  }),

  /* Onboarding ---------------------------------------------------------- */

  http.post(`${V1}/onboard/1`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { name?: string; website?: string }
    if (db.me.team) {
      if (body.name) db.me.team.name = body.name
      if (body.website) db.me.team.website = body.website
      db.me.team.onboarding_stage = 2
    }
    return HttpResponse.json({ success: true, stage: 2 })
  }),

  http.post(`${V1}/onboard/2`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      intent_slugs?: string[]
      team_size?: string
      tickets_per_month?: string
    }
    if (db.me.team) {
      if (body.intent_slugs) db.me.team.onboarding_intent_slugs = body.intent_slugs
      if (body.team_size) db.me.team.team_size = body.team_size
      if (body.tickets_per_month) db.me.team.tickets_per_month = body.tickets_per_month
      db.me.team.onboarding_stage = 3
    }
    return HttpResponse.json({ success: true, stage: 3 })
  }),

  http.post(`${V1}/onboard/3`, async () => {
    await latency()
    if (db.me.team) {
      db.me.team.show_onboarding = false
      db.me.team.onboarding_stage = 3
    }
    return HttpResponse.json({ success: true, onboard_user: false })
  }),

  http.post(`${V1}/onboard/dismiss`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { slug: string }
    if (db.me.team && !db.me.team.dismissed_onboarding_action_slugs.includes(body.slug)) {
      db.me.team.dismissed_onboarding_action_slugs.push(body.slug)
    }
    return HttpResponse.json({ success: true })
  }),

  /* Front inboxes ------------------------------------------------------- */

  http.get(`${V1}/front-inboxes`, async () => {
    await latency()
    return HttpResponse.json(db.frontInboxes)
  }),

  http.post(`${V1}/front-inboxes`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      inboxes: Array<{ id: number; is_enabled: boolean }>
      is_onboarding?: boolean
    }
    for (const update of body.inboxes) {
      const inbox = db.frontInboxes.find((candidate) => candidate.id === update.id)
      if (inbox) inbox.is_enabled = update.is_enabled
    }
    if (db.me.team) {
      db.me.team.has_any_front_inbox_enabled = db.frontInboxes.some((inbox) => inbox.is_enabled)
    }
    return HttpResponse.json({ success: true })
  }),
]
