import { cn } from '@/lib/utils'
import arlo from '@/assets/brand-logos/arlo.svg'
import front from '@/assets/brand-logos/front.svg'
import gmail from '@/assets/brand-logos/gmail.svg'
import gorgias from '@/assets/brand-logos/gorgias.svg'
import salesforce from '@/assets/brand-logos/salesforce.svg'
import shopify from '@/assets/brand-logos/shopify.svg'
import woocommerce from '@/assets/brand-logos/woocommerce.svg'
import zendesk from '@/assets/brand-logos/zendesk.svg'

/**
 * Real brand marks, carried over from the v5 dashboard. These are the one place
 * the palette rule (scale tokens only) does not apply — a vendor's logo is
 * their asset and recolouring it makes it harder to recognise, not more
 * consistent.
 *
 * Each file keeps its own aspect ratio, so they render inside a square box with
 * `object-contain` rather than being stretched to it.
 */

export type IntegrationSlug =
  'zendesk' | 'front' | 'gorgias' | 'gmail' | 'shopify' | 'woocommerce' | 'arlo' | 'salesforce'

const logos: Record<IntegrationSlug, string> = {
  zendesk,
  front,
  gorgias,
  gmail,
  shopify,
  woocommerce,
  arlo,
  salesforce,
}

const LABELS: Record<IntegrationSlug, string> = {
  zendesk: 'Zendesk',
  front: 'Front',
  gorgias: 'Gorgias',
  gmail: 'Gmail',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  arlo: 'Arlo',
  salesforce: 'Salesforce',
}

export function IntegrationGlyph({
  slug,
  className,
}: {
  slug: IntegrationSlug | string
  className?: string
}) {
  const logo = logos[slug as IntegrationSlug]

  /* Anything without a mark falls back to its initials rather than a broken
   * image — the catalog can name an integration before its logo lands. */
  if (!logo) {
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
    <img
      src={logo}
      alt={LABELS[slug as IntegrationSlug] ?? slug}
      loading="lazy"
      className={cn('size-5 shrink-0 object-contain', className)}
    />
  )
}
