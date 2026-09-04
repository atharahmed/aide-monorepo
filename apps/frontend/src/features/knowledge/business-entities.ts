import {
  AtSign,
  Building2,
  Camera,
  Code,
  Globe,
  Mail,
  Phone,
  Pin,
  Smartphone,
  UserRound,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

export type EntityValues = Record<string, string>

/**
 * `key` is what goes in the stored blob; `label` is v5's placeholder, derived
 * from the camelCase property name its dialog read off the entity class.
 */
export interface EntityField {
  key: string
  label: string
}

export interface EntityDefinition {
  slug: string
  title: string
  icon: LucideIcon
  fields: EntityField[]
  displayName: (values: EntityValues) => string
  href: (values: EntityValues) => string | null
  /**
   * Recovers fields from a bare URL or number, mirroring the `match()` methods
   * in `funcnlp/knowledge_entities.py`. Used to read rows the old label/value
   * editor left holding nothing but the text the user pasted.
   */
  parse?: (raw: string) => EntityValues | null
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }
}

const hostOf = (url: URL) => url.hostname.replace(/^www\./, '')

const segmentsOf = (url: URL) => url.pathname.split('/').filter(Boolean)

function handleFrom(raw: string, hosts: string[], reserved: string[] = []) {
  const url = parseUrl(raw)
  if (!url || !hosts.includes(hostOf(url))) return null
  const segments = segmentsOf(url)
  if (segments.length !== 1 || reserved.includes(segments[0])) return null
  return segments[0].replace(/^@/, '')
}

function nestedHandleFrom(raw: string, prefix: string) {
  const url = parseUrl(raw)
  if (!url || hostOf(url) !== 'linkedin.com') return null
  const segments = segmentsOf(url)
  return segments[0] === prefix && segments[1] ? segments[1] : null
}

export const ENTITY_DEFINITIONS: EntityDefinition[] = [
  {
    slug: 'phone_number',
    title: 'Phone Number',
    icon: Phone,
    fields: [
      { key: 'country_code', label: 'CountryCode' },
      { key: 'national_number', label: 'NationalNumber' },
    ],
    displayName: (values) => `${values.country_code} ${values.national_number}`,
    href: (values) => `tel:${values.country_code}${values.national_number}`,
    parse: (raw) => {
      const digits = raw.replace(/^tel:/, '').replace(/\D/g, '')
      if (!digits) return null
      if ((digits.startsWith('1') && digits.length === 11) || digits.length === 10) {
        return { country_code: '+1', national_number: digits.slice(-10) }
      }
      const match = /^(\d{1,3})(\d+)$/.exec(digits)
      return match ? { country_code: `+${match[1]}`, national_number: match[2] } : null
    },
  },
  {
    slug: 'youtube_channel',
    title: 'YouTube Channel',
    icon: Video,
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'channel_id', label: 'ChannelId' },
      { key: 'custom_url', label: 'CustomUrl' },
    ],
    displayName: (values) => values.title,
    href: (values) =>
      values.custom_url
        ? `https://www.youtube.com/${values.custom_url}`
        : `https://www.youtube.com/channel/${values.channel_id}`,
    parse: (raw): EntityValues | null => {
      const url = parseUrl(raw)
      if (!url || !['youtube.com', 'm.youtube.com'].includes(hostOf(url))) return null
      const segments = segmentsOf(url)
      const channelIndex = segments.indexOf('channel')
      if (channelIndex >= 0 && segments[channelIndex + 1]) {
        return { channel_id: segments[channelIndex + 1] }
      }
      const handle = segments.find((segment) => segment.startsWith('@'))
      if (handle) return { custom_url: handle }
      const custom = segments[0] === 'c' || segments[0] === 'user' ? segments[1] : segments[0]
      return custom ? { custom_url: custom } : null
    },
  },
  {
    slug: 'email_address',
    title: 'Email Address',
    icon: Mail,
    fields: [{ key: 'email', label: 'Email' }],
    displayName: (values) => values.email,
    href: (values) => `mailto:${values.email}`,
    parse: (raw) => {
      const email = raw.replace(/^mailto:/, '').trim()
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : null
    },
  },
  {
    slug: 'apple_app_store_listing',
    title: 'Apple App Store Listing',
    icon: Smartphone,
    fields: [
      { key: 'app_id', label: 'AppId' },
      { key: 'country_code', label: 'CountryCode' },
      { key: 'title', label: 'Title' },
    ],
    displayName: (values) => values.title || `App ID: ${values.app_id}`,
    href: (values) =>
      `https://apps.apple.com/${values.country_code || 'us'}/app/id${values.app_id}`,
    parse: (raw) => {
      const url = parseUrl(raw)
      if (!url || !['apps.apple.com', 'itunes.apple.com'].includes(hostOf(url))) return null
      const segments = segmentsOf(url)
      const appId = segments.find((segment) => /^id\d+$/.test(segment))?.slice(2)
      if (!appId) return null
      const country = /^[a-z]{2}$/.test(segments[0]) ? segments[0] : ''
      return { app_id: appId, country_code: country }
    },
  },
  {
    slug: 'google_play_store_listing',
    title: 'Google Play Store Listing',
    icon: Smartphone,
    fields: [
      { key: 'app_id', label: 'AppId' },
      { key: 'title', label: 'Title' },
    ],
    displayName: (values) => values.title || `App ID: ${values.app_id}`,
    href: (values) => `https://play.google.com/store/apps/details?id=${values.app_id}`,
    parse: (raw) => {
      const url = parseUrl(raw)
      if (!url || hostOf(url) !== 'play.google.com') return null
      const appId = url.searchParams.get('id')
      return appId ? { app_id: appId } : null
    },
  },
  {
    slug: 'x_profile',
    title: 'X Profile',
    icon: AtSign,
    fields: [{ key: 'username', label: 'Username' }],
    displayName: (values) => `@${values.username}`,
    href: (values) => `https://x.com/${values.username}`,
    parse: (raw) => {
      const username = handleFrom(raw, ['x.com', 'twitter.com'], ['search'])
      return username ? { username } : null
    },
  },
  {
    slug: 'pinterest_profile',
    title: 'Pinterest Profile',
    icon: Pin,
    fields: [{ key: 'username', label: 'Username' }],
    displayName: (values) => values.username,
    href: (values) => `https://pinterest.com/${values.username}`,
    parse: (raw) => {
      const username = handleFrom(raw, ['pinterest.com'])
      return username ? { username } : null
    },
  },
  {
    slug: 'linkedin_personal_profile',
    title: 'LinkedIn Personal Profile',
    icon: UserRound,
    fields: [{ key: 'username', label: 'Username' }],
    displayName: (values) => values.username,
    href: (values) => `https://linkedin.com/in/${values.username}`,
    parse: (raw) => {
      const username = nestedHandleFrom(raw, 'in')
      return username ? { username } : null
    },
  },
  {
    slug: 'linkedin_company_profile',
    title: 'LinkedIn Company Profile',
    icon: Building2,
    fields: [{ key: 'company_id', label: 'CompanyId' }],
    displayName: (values) => `Company ID: ${values.company_id}`,
    href: (values) => `https://linkedin.com/company/${values.company_id}`,
    parse: (raw) => {
      const companyId = nestedHandleFrom(raw, 'company')
      return companyId ? { company_id: companyId } : null
    },
  },
  {
    slug: 'github_profile',
    title: 'GitHub Profile',
    icon: Code,
    fields: [{ key: 'username', label: 'Username' }],
    displayName: (values) => values.username,
    href: (values) => `https://github.com/${values.username}`,
    parse: (raw) => {
      const reserved = [
        'features',
        'enterprise',
        'team',
        'topics',
        'collections',
        'events',
        'sponsors',
        'search',
      ]
      const username = handleFrom(raw, ['github.com'], reserved)
      return username ? { username } : null
    },
  },
  {
    slug: 'instagram_profile',
    title: 'Instagram Profile',
    icon: Camera,
    fields: [{ key: 'username', label: 'Username' }],
    displayName: (values) => `@${values.username}`,
    href: (values) => `https://instagram.com/${values.username}`,
    parse: (raw) => {
      const username = handleFrom(raw, ['instagram.com'], ['explore', 'p', 'reel', 'stories'])
      return username ? { username } : null
    },
  },
  {
    slug: 'facebook_profile',
    title: 'Facebook Profile',
    icon: Users,
    fields: [{ key: 'identifier', label: 'Identifier' }],
    displayName: (values) => values.identifier,
    href: (values) => `https://facebook.com/${values.identifier}`,
    parse: (raw) => {
      const identifier = handleFrom(raw, ['facebook.com', 'web.facebook.com'])
      return identifier ? { identifier } : null
    },
  },
  {
    slug: 'website',
    title: 'Website',
    icon: Globe,
    fields: [{ key: 'url', label: 'Url' }],
    displayName: (values) => {
      try {
        return new URL(values.url).hostname
      } catch {
        return values.url
      }
    },
    href: (values) => values.url.replace(/^(?!https?:\/\/)/, 'https://'),
    parse: (raw) => (parseUrl(raw) ? { url: raw } : null),
  },
]

export const SYNC_FREQUENCIES = [
  { value: 'sync every week', label: 'Sync every week' },
  { value: 'sync every 2 weeks', label: 'Sync every 2 weeks' },
  { value: 'sync every 3 weeks', label: 'Sync every 3 weeks' },
  { value: 'sync every 4 weeks', label: 'Sync every 4 weeks' },
  { value: 'never sync', label: 'Never sync' },
]

export const DEFAULT_SYNC_FREQUENCY = 'sync every week'

const titleFromSlug = (slug: string) =>
  slug.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

/** Anything the account holds that this build does not know about still lists. */
function fallbackDefinition(slug: string): EntityDefinition {
  return {
    slug,
    title: titleFromSlug(slug),
    icon: Globe,
    fields: [],
    displayName: () => '',
    href: () => null,
  }
}

/**
 * The label/value editor this page used to carry slugified whatever the user
 * typed, turning `instagram_profile` into `instagram-profile`.
 */
export const normalizeEntitySlug = (slug: string) => slug.trim().toLowerCase().replace(/-/g, '_')

export function knownEntityDefinition(slug: string): EntityDefinition | undefined {
  const normalized = normalizeEntitySlug(slug)
  return ENTITY_DEFINITIONS.find((definition) => definition.slug === normalized)
}

export function entityDefinition(slug: string): EntityDefinition {
  return knownEntityDefinition(slug) ?? fallbackDefinition(slug)
}

const toCamelCase = (key: string) =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())

/**
 * The v5 dialog wrote camelCase keys while its reader and the extraction
 * pipeline used snake_case, so both spellings exist in the store.
 */
export function entityValues(
  definition: EntityDefinition,
  entity: Record<string, unknown>
): EntityValues {
  const values: EntityValues = Object.fromEntries(
    definition.fields.map(({ key }) => {
      const raw = entity[key] ?? entity[toCamelCase(key)]
      return [key, raw === null || raw === undefined ? '' : String(raw)]
    })
  )

  if (definition.fields.some(({ key }) => values[key])) return values

  /* Nothing usable in the blob: fall back to parsing the text the old
   * label/value editor stored, so the row reads and edits like a real one. */
  const legacy = entity.value ?? entity.label
  const recovered = typeof legacy === 'string' && definition.parse ? definition.parse(legacy) : null

  return recovered ? { ...values, ...recovered } : values
}

/**
 * Several templates prepend literal text — `@${username}`, `Company ID: ` —
 * so they read as filled even when every field is blank.
 */
const hasValues = (definition: EntityDefinition, values: EntityValues) =>
  definition.fields.some(({ key }) => values[key])

/** No link at all beats one built from blanks — `https://instagram.com/`. */
export function entityHref(slug: string, entity: Record<string, unknown>): string | null {
  const definition = entityDefinition(slug)
  const values = entityValues(definition, entity)
  return hasValues(definition, values) ? definition.href(values) : null
}

export function entityDisplayName(slug: string, entity: Record<string, unknown>): string {
  const definition = entityDefinition(slug)
  const values = entityValues(definition, entity)
  const name = hasValues(definition, values) ? definition.displayName(values).trim() : ''
  if (name) return name

  /* Rows the old label/value editor wrote keep their text under `value`. */
  const fallback = [entity.value, entity.label, ...Object.values(entity)].find(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== ''
  )
  return typeof fallback === 'string' ? fallback : ''
}
