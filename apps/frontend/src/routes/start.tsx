import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo, Wordmark } from '@/components/logo'
import { FormError } from '@/features/auth/auth-shell'
import {
  onboardingIntents,
  type OnboardingIntent,
  type OnboardingIntentSlugValue,
} from '@/features/onboarding/actions'
import { meQueryOptions, queryKeys } from '@/lib/queries'
import { toast } from 'sonner'

export const Route = createFileRoute('/start')({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' })
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQueryOptions),
  component: StartPage,
})

const TEAM_SIZES = ['Just me', '2-10', '11-50', '51-200', '200+']
const TICKET_VOLUMES = ['Under 500', '500-1000', '1000-5000', '5000-20000', '20000+']

/**
 * The wizard splits the intents the same way the API does: `onboard/2` records
 * the tools to connect and *replaces* the stored slugs, `onboard/3` records how
 * the team wants to use Aide and *appends* to them. Sending the same list to
 * both stores every slug twice, so the two screens keep separate selections.
 */
const USAGE_GROUP = 'What you want to do'
const integrationIntents = onboardingIntents.filter((intent) => intent.group !== USAGE_GROUP)
const usageIntents = onboardingIntents.filter((intent) => intent.group === USAGE_GROUP)

const WEBSITE_PATTERN = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+([\/\w \.-]*)*\/?$/

/** Server messages are field names verbatim — `job_role is required`. */
const humanise = (message: string) => message.replace(/_/g, ' ')

function StartPage() {
  const me = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /* `onboarding_stage` is 0 before anything is saved and counts completed
   * steps, so the screen to show is the one after it. */
  const [step, setStep] = useState(Math.min((me.team?.onboarding_stage ?? 0) + 1, 3))
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [fullName, setFullName] = useState(me.name ?? '')
  const [jobRole, setJobRole] = useState(me.job_title ?? '')
  const [phone, setPhone] = useState(me.phone_number ?? '')
  const [companyName, setCompanyName] = useState(me.team?.name ?? '')
  const [website, setWebsite] = useState(me.team?.website ?? '')
  const [useWebsiteData, setUseWebsiteData] = useState(me.team?.use_website_data ?? true)
  const [teamSize, setTeamSize] = useState(me.team?.team_size ?? '')
  const [volume, setVolume] = useState(me.team?.tickets_per_month ?? '')

  const saved = (me.team?.onboarding_intent_slugs ?? []) as OnboardingIntentSlugValue[]
  const [integrations, setIntegrations] = useState(() =>
    saved.filter((slug) => integrationIntents.some((intent) => intent.slug === slug))
  )
  const [usage, setUsage] = useState(() =>
    saved.filter((slug) => usageIntents.some((intent) => intent.slug === slug))
  )

  const advance = async (to: number, call: () => Promise<unknown>) => {
    setPending(true)
    try {
      await call()
      await queryClient.invalidateQueries({ queryKey: queryKeys.me })
      if (to > 3) {
        navigate({ to: '/home' })
        return
      }
      setErrors({})
      setStep(to)
    } catch (caught) {
      const fieldErrors = caught instanceof ApiError ? caught.fieldErrors : {}
      if (Object.keys(fieldErrors).length) {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors).map(([field, message]) => [field, humanise(message)])
          )
        )
      } else {
        toast.error('Could not save that step. Try again.')
      }
    } finally {
      setPending(false)
    }
  }

  /**
   * `/v1/onboard/1` takes the whole profile in one call — the person, the
   * company and the volumes. It also kicks off the website crawl, so it is sent
   * exactly once, from this step.
   */
  const submitProfile = (event: React.FormEvent) => {
    event.preventDefault()

    const invalid: Record<string, string> = {}
    if (!fullName.trim()) invalid.name = 'Name is required'
    if (!jobRole.trim()) invalid.job_role = 'Job role is required'
    if (!phone.trim()) invalid.phone_number = 'Phone number is required'
    if (!companyName.trim()) invalid.company_name = 'Company name is required'
    if (!website.trim()) invalid.company_website = 'Company website is required'
    else if (!WEBSITE_PATTERN.test(website.trim()))
      invalid.company_website = 'Please enter a valid website URL'

    setErrors(invalid)
    if (Object.keys(invalid).length > 0) return

    return advance(2, () =>
      api.post('/v1/onboard/1', {
        name: fullName.trim(),
        job_role: jobRole.trim(),
        phone_number: phone.trim(),
        company_name: companyName.trim(),
        company_website: website.trim(),
        team_size: teamSize,
        tickets_per_month: volume,
        use_website_data: useWebsiteData,
      })
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Logo />
          <Wordmark />
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                index === step
                  ? 'w-6 bg-gray-950'
                  : index < step
                    ? 'w-4 bg-gray-400'
                    : 'w-4 bg-gray-200'
              )}
            />
          ))}
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div key={step} className="w-full max-w-2xl animate-in duration-300 fade-in">
          {step === 1 && (
            <section>
              <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-gray-950">
                Tell us about you and your company
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                We use your website to learn your products and policies.
              </p>

              <form onSubmit={submitProfile} noValidate className="mt-7 max-w-md">
                <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">You</p>
                <div className="mt-2.5 flex flex-col gap-4">
                  <div>
                    <Label htmlFor="full-name">Your name</Label>
                    <Input
                      id="full-name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      aria-invalid={Boolean(errors.name)}
                      className="mt-1.5"
                      placeholder="Julia Marten"
                    />
                    <FormError>{errors.name}</FormError>
                  </div>
                  <div>
                    <Label htmlFor="job-role">Job title</Label>
                    <Input
                      id="job-role"
                      value={jobRole}
                      onChange={(event) => setJobRole(event.target.value)}
                      aria-invalid={Boolean(errors.job_role)}
                      className="mt-1.5"
                      placeholder="Head of Support"
                    />
                    <FormError>{errors.job_role}</FormError>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      aria-invalid={Boolean(errors.phone_number)}
                      className="mt-1.5"
                      placeholder="+1 555 123 4567"
                    />
                    <FormError>{errors.phone_number}</FormError>
                  </div>
                </div>

                <p className="mt-6 border-t border-black/5 pt-5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
                  Your company
                </p>
                <div className="mt-2.5 flex flex-col gap-4">
                  <div>
                    <Label htmlFor="company">Company name</Label>
                    <Input
                      id="company"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      aria-invalid={Boolean(errors.company_name)}
                      className="mt-1.5"
                      placeholder="Northwind Outdoors"
                    />
                    <FormError>{errors.company_name}</FormError>
                  </div>
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      aria-invalid={Boolean(errors.company_website)}
                      className="mt-1.5"
                      placeholder="https://yourcompany.com"
                    />
                    <FormError>{errors.company_website}</FormError>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Checkbox
                        id="use-website-data"
                        checked={useWebsiteData}
                        onCheckedChange={(checked) => setUseWebsiteData(checked === true)}
                      />
                      <Label htmlFor="use-website-data" className="text-[12.5px] text-gray-500">
                        Use my website to improve answers
                      </Label>
                    </div>
                  </div>

                  <ChoiceRow
                    label="Support team size"
                    options={TEAM_SIZES}
                    value={teamSize}
                    onChange={setTeamSize}
                  />
                  <ChoiceRow
                    label="Conversations per month"
                    options={TICKET_VOLUMES}
                    value={volume}
                    onChange={setVolume}
                  />
                </div>

                <Button type="submit" size="lg" className="mt-7" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Continue
                </Button>
              </form>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-gray-950">
                What do you want to connect?
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                Pick everything that applies. You can change this later.
              </p>

              <IntentGrid
                intents={integrationIntents}
                selected={integrations}
                onToggle={(slug) =>
                  setIntegrations((current) =>
                    current.includes(slug)
                      ? current.filter((value) => value !== slug)
                      : [...current, slug]
                  )
                }
              />

              <div className="mt-6 flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  size="lg"
                  disabled={pending}
                  onClick={() =>
                    advance(3, () => api.post('/v1/onboard/2', { intent_slugs: integrations }))
                  }
                >
                  {pending && <Loader2 className="animate-spin" />}
                  {integrations.length === 0 ? 'Skip' : 'Continue'}
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-gray-950">
                How do you want to use Aide?
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                Pick everything that applies. You can change this later.
              </p>

              <IntentGrid
                intents={usageIntents}
                selected={usage}
                onToggle={(slug) =>
                  setUsage((current) =>
                    current.includes(slug)
                      ? current.filter((value) => value !== slug)
                      : [...current, slug]
                  )
                }
              />

              <div className="mt-6 flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  size="lg"
                  disabled={pending}
                  /* Stage 3 is what clears `show_onboarding`, so it goes last. */
                  onClick={() =>
                    advance(4, () => api.post('/v1/onboard/3', { intent_slugs: usage }))
                  }
                >
                  {pending && <Loader2 className="animate-spin" />}
                  Finish setup
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function IntentGrid({
  intents,
  selected,
  onToggle,
}: {
  intents: OnboardingIntent[]
  selected: OnboardingIntentSlugValue[]
  onToggle: (slug: OnboardingIntentSlugValue) => void
}) {
  const groups = [...new Set(intents.map((intent) => intent.group))]

  return (
    <div className="mt-7 flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            {group}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {intents
              .filter((intent) => intent.group === group)
              .map((intent) => {
                const isSelected = selected.includes(intent.slug)
                return (
                  <button
                    key={intent.slug}
                    type="button"
                    onClick={() => onToggle(intent.slug)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex items-start gap-3 rounded-[8px] border p-3 text-left transition-colors',
                      isSelected
                        ? 'border-gray-950 bg-white'
                        : 'border-black/5 bg-white hover:border-gray-300'
                    )}
                  >
                    <span className="mt-0.5 shrink-0">{intent.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-gray-950">
                        {intent.title}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-gray-500">
                        {intent.description}
                      </span>
                    </span>
                    {isSelected && <Check className="mt-0.5 size-4 shrink-0 text-gray-950" />}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChoiceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
              value === option
                ? 'border-gray-950 bg-gray-950 text-white'
                : 'border-black/5 bg-white text-gray-700 hover:border-gray-300'
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
