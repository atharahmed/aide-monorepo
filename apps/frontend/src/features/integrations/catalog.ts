/**
 * The integrations catalog is client-side — the API only reports which ones are
 * connected. Field configs mirror `IntegrationsUIEntries.ts` on the backend, so
 * the OAuth handshake keeps working unchanged.
 */

import type { IntegrationSlug } from '@/components/integration-glyph'

export type IntegrationGroup = 'Helpdesk' | 'E-commerce' | 'Contacts'

export interface IntegrationEntry {
  slug: IntegrationSlug
  name: string
  group: IntegrationGroup
  summary: string
  /** What Aide reads once connected — shown on the detail page. */
  reads: string[]
  field?: {
    key: string
    label: string
    placeholder: string
    /** `{}` is replaced by the value as the user types. */
    template: string
  }
  /** Where to send the user after a successful connect. */
  successRedirect?: string
  /** Some integrations are installed from the vendor's marketplace. */
  externalInstallUrl?: string
}

export const integrationCatalog: IntegrationEntry[] = [
  {
    slug: 'zendesk',
    name: 'Zendesk',
    group: 'Helpdesk',
    summary: 'Sync tickets, macros, help centre articles and contacts.',
    reads: [
      'Tickets and comments',
      'Macros',
      'Help centre articles',
      'End users and organisations',
    ],
    field: {
      key: 'subdomain',
      label: 'Zendesk subdomain',
      placeholder: 'your-company',
      template: 'Your Zendesk URL is {}.zendesk.com',
    },
  },
  {
    slug: 'front',
    name: 'Front',
    group: 'Helpdesk',
    summary: 'Sync conversations, tags and message templates.',
    reads: ['Conversations and comments', 'Tags', 'Message templates', 'Teammates'],
    successRedirect: '/integrations/front/inboxes',
  },
  {
    slug: 'gorgias',
    name: 'Gorgias',
    group: 'Helpdesk',
    summary: 'Sync conversations, tags and customer records.',
    reads: ['Tickets and messages', 'Tags', 'Customers'],
    field: {
      key: 'account',
      label: 'Gorgias account',
      placeholder: 'your-company',
      template: 'Your Gorgias URL is {}.gorgias.com',
    },
  },
  {
    slug: 'gmail',
    name: 'Gmail',
    group: 'Helpdesk',
    summary: 'Sync threads, labels and contacts from a shared mailbox.',
    reads: ['Threads and messages', 'Labels', 'Contacts'],
  },
  {
    slug: 'shopify',
    name: 'Shopify',
    group: 'E-commerce',
    summary: 'Read orders, fulfilments, products and inventory.',
    reads: ['Orders and fulfilments', 'Products and variants', 'Customers', 'Inventory levels'],
    externalInstallUrl: 'https://apps.shopify.com/aide',
  },
  {
    slug: 'woocommerce',
    name: 'WooCommerce',
    group: 'E-commerce',
    summary: 'Read orders, products and customers from your store.',
    reads: ['Orders', 'Products', 'Customers'],
    field: {
      key: 'store_url',
      label: 'Store URL',
      placeholder: 'https://yourstore.com',
      template: 'Enter the URL of your store',
    },
  },
  {
    slug: 'arlo',
    name: 'Arlo',
    group: 'E-commerce',
    summary: 'Read registrations, events and attendee records.',
    reads: ['Events', 'Registrations', 'Attendees'],
    field: {
      key: 'platform_name',
      label: 'Arlo platform',
      placeholder: 'your-company',
      template: 'Your Arlo URL is {}.arlo.co',
    },
  },
  {
    slug: 'salesforce',
    name: 'Salesforce',
    group: 'Contacts',
    summary: 'Sync contact and account fields onto conversations.',
    reads: ['Contacts', 'Accounts', 'Custom fields'],
    field: {
      key: 'domain',
      label: 'Salesforce domain',
      placeholder: 'your-company',
      template: 'Your Salesforce URL is {}.my.salesforce.com',
    },
  },
]

export const integrationGroups: IntegrationGroup[] = ['Helpdesk', 'E-commerce', 'Contacts']

export const findIntegration = (slug: string) =>
  integrationCatalog.find((integration) => integration.slug === slug)
