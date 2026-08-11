import { cn } from '@/lib/utils'

/**
 * Monochrome marks for each integration. They inherit `currentColor` rather
 * than carrying brand hexes: the palette rule is scale tokens only, and a row
 * of brand colours would fight the monochrome shell. Shapes stay recognisable
 * at 16px — the silhouette does the identifying, not the colour.
 */

export type IntegrationSlug =
  | 'zendesk'
  | 'front'
  | 'gorgias'
  | 'gmail'
  | 'shopify'
  | 'woocommerce'
  | 'arlo'
  | 'salesforce'
  | 'stripe'

const paths: Record<IntegrationSlug, React.ReactNode> = {
  /* Zendesk — the two facing triangles. */
  zendesk: (
    <>
      <path d="M11 3v11L2 14z" />
      <path d="M13 21V10l9 0z" />
    </>
  ),
  /* Front — a stacked pair of conversation planes. */
  front: (
    <>
      <path d="M3 6.5 12 2l9 4.5-9 4.5z" />
      <path d="M3 13.5 12 18l9-4.5" opacity="0.55" />
      <path d="M3 18 12 22l9-4" opacity="0.3" />
    </>
  ),
  /* Gorgias — a rounded speech mark with a notch. */
  gorgias: (
    <>
      <path d="M12 2a10 10 0 1 0 5.6 18.28L22 22l-1.5-4.2A10 10 0 0 0 12 2Zm0 5.5 2.2 4.4L12 16.5l-2.2-4.6Z" />
    </>
  ),
  /* Gmail — the envelope with its distinctive inner V. */
  gmail: (
    <>
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5Zm2.4-.5L12 12.2 19.6 6Z" />
    </>
  ),
  /* Shopify — the shopping bag silhouette. */
  shopify: (
    <>
      <path d="M9 3.5a3 3 0 0 1 6 0V6h3.2l1.3 15H4.5L5.8 6H9Zm2 2.5h2V3.5a1 1 0 0 0-2 0Z" />
    </>
  ),
  /* WooCommerce — the double-chevron 'W' in a rounded plate. */
  woocommerce: (
    <>
      <path d="M2 6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-4 4v-4H5a3 3 0 0 1-3-3Zm4 1.5 1.8 6L9.5 8l1.7 5.5L13 7.5l1.8 6 1.7-5.5" />
    </>
  ),
  /* Arlo — a signal arc over a base. */
  arlo: (
    <>
      <path d="M12 4a10 10 0 0 1 10 10h-3a7 7 0 0 0-14 0H2A10 10 0 0 1 12 4Z" />
      <circle cx="12" cy="17" r="3" />
    </>
  ),
  /* Salesforce — the three-lobed cloud. */
  salesforce: (
    <>
      <path d="M9.4 6.6a4 4 0 0 1 6.7 1 3.4 3.4 0 0 1 4.6 3.2 3.6 3.6 0 0 1-3.6 3.6H7.2A4.2 4.2 0 0 1 3 10.2a4.2 4.2 0 0 1 3.6-4.1 4 4 0 0 1 2.8.5Z" />
    </>
  ),
  /* Stripe — the S-bar. */
  stripe: (
    <>
      <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7.6 5.2c-2 0-3.4 1-3.4 2.6 0 2.9 4 2.3 4 3.6 0 .5-.4.8-1.2.8-1 0-2.3-.5-3.2-1v2.4c.9.4 2 .6 3.2.6 2.1 0 3.6-1 3.6-2.7 0-3-4-2.4-4-3.6 0-.4.4-.7 1.1-.7.9 0 2 .3 2.9.8V8.7c-.9-.3-1.9-.5-3-.5Z" />
    </>
  ),
}

export function IntegrationGlyph({
  slug,
  className,
}: {
  slug: IntegrationSlug | string
  className?: string
}) {
  const path = paths[slug as IntegrationSlug]

  if (!path) {
    return (
      <span
        className={cn(
          'inline-flex size-5 items-center justify-center rounded-[4px] bg-gray-200 text-[9px] font-semibold text-gray-600 uppercase',
          className
        )}
      >
        {slug.slice(0, 2)}
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn('size-5 text-gray-700', className)}
    >
      {path}
    </svg>
  )
}
