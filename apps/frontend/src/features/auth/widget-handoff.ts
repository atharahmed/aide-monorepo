/**
 * Session handoff to the helpdesk panels.
 *
 * The Front, Zendesk and WordPress panels are already shipped and expect an
 * exact exchange, so this mirrors the v5 dashboard rather than improving on it:
 *
 * - The panel embeds `/login` in an iframe. When that page has no session it
 *   posts the bare string `login_required` to its parent, and the panel reacts
 *   by opening `/login?source=<panel>` in a popup.
 * - Once signed in, the popup lands on `/login/widget`, which posts the user's
 *   `widget_token` — a bare string, not an object — to `window.opener` at the
 *   panel's own origin, then closes itself.
 *
 * The message payloads and the target origins are part of that contract. A
 * wrong origin means `postMessage` silently drops the token and the panel hangs
 * on "logging in" forever.
 */

export const WIDGET_SOURCES = ['front', 'zendesk', 'wordpress'] as const

export type WidgetSource = (typeof WIDGET_SOURCES)[number]

/** Sent to the embedding panel when the iframe finds no session. */
export const LOGIN_REQUIRED_MESSAGE = 'login_required'

const PRODUCTION_ORIGINS: Record<WidgetSource, string> = {
  front: 'https://front.aide.app',
  zendesk: 'https://zendesk.aide.app',
  wordpress: 'https://my.aide.app',
}

/** Where the panels run during local development. */
const DEVELOPMENT_ORIGIN = 'http://localhost:3000'

export function isWidgetSource(value: unknown): value is WidgetSource {
  return typeof value === 'string' && WIDGET_SOURCES.includes(value as WidgetSource)
}

export function parseWidgetSource(value: unknown): WidgetSource | undefined {
  return isWidgetSource(value) ? value : undefined
}

/**
 * `originOverride` lets a panel running somewhere else — a staging build, a
 * self-hosted WordPress site — name its own origin on the way in.
 */
export function widgetTargetOrigin(source: WidgetSource, originOverride?: string): string {
  if (originOverride) return originOverride
  return import.meta.env.PROD ? PRODUCTION_ORIGINS[source] : DEVELOPMENT_ORIGIN
}

/** Tells an embedding panel that the user has to sign in. Safe outside a frame. */
export function notifyParentLoginRequired() {
  if (window.parent === window) return
  window.parent.postMessage(LOGIN_REQUIRED_MESSAGE, '*')
}

/**
 * Hands the widget token to the panel that opened this window. Returns false
 * when there is no opener, which is how the page knows to show an error rather
 * than closing on a message nobody received.
 */
export function postWidgetToken(
  widgetToken: string,
  source: WidgetSource,
  originOverride?: string
): boolean {
  if (!window.opener) return false
  window.opener.postMessage(widgetToken, widgetTargetOrigin(source, originOverride))
  return true
}
