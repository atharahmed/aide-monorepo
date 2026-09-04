import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PhoneInput } from '@/components/ui/phone-input'
import { Textarea } from '@/components/ui/textarea'
import { Logo, Wordmark } from '@/components/logo'
import {
  onboardingIntents,
  OnboardingIntentSlug,
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

const WEBSITE_PATTERN = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+([\/\w \.-]*)*\/?$/

function StartPage() {
  const me = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /* `onboarding_stage` is 0 before anything is saved and counts completed
   * steps, so the screen to resume on is the one after it. */
  const [step, setStep] = useState(Math.min((me.team?.onboarding_stage ?? 0) + 1, 3))
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [fullName, setFullName] = useState(me.name ?? '')
  const [jobRole, setJobRole] = useState(me.job_title ?? '')
  const [phone, setPhone] = useState(me.phone_number ?? '')
  const [companyName, setCompanyName] = useState(me.team?.name ?? '')
  const [website, setWebsite] = useState(me.team?.website ?? '')
  const [useWebsiteData, setUseWebsiteData] = useState(me.team?.use_website_data ?? true)
  const [intents, setIntents] = useState<OnboardingIntentSlugValue[]>(
    (me.team?.onboarding_intent_slugs ?? []) as OnboardingIntentSlugValue[]
  )
  const [otherIntent, setOtherIntent] = useState('')
  const [teamSize, setTeamSize] = useState(me.team?.team_size ?? '')
  const [volume, setVolume] = useState(me.team?.tickets_per_month ?? '')

  const toggleIntent = (slug: OnboardingIntentSlugValue) =>
    setIntents((current) =>
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug]
    )

  const advance = async (to: number, call: () => Promise<unknown>) => {
    setPending(true)
    setFieldErrors({})
    try {
      await call()
      await queryClient.invalidateQueries({ queryKey: queryKeys.me })
      if (to > 3) {
        navigate({ to: '/home' })
        return
      }
      setStep(to)
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const humanized: Record<string, string> = {}
        for (const [field, message] of Object.entries(error.fieldErrors)) {
          humanized[field] = message.replace(/_/g, ' ')
        }
        setFieldErrors(humanized)
      } else {
        toast.error('Could not save that step. Try again.')
      }
    } finally {
      setPending(false)
    }
  }

  /**
   * `/v1/onboard/1` takes the whole profile in one call — the person, the
   * company and the volumes. It also kicks off the website crawl and rewinds
   * `onboarding_stage` to 1, so it is sent exactly once, from this step.
   *
   * The API validates every field bar the two volumes, so the same rules are
   * checked here first rather than round-tripping to collect a 422.
   */
  const submitProfile = () => {
    const invalid: Record<string, string> = {}
    if (!fullName.trim()) invalid.name = 'Name is required'
    if (!jobRole.trim()) invalid.job_role = 'Job role is required'
    if (!phone.trim()) invalid.phone_number = 'Phone number is required'
    if (!companyName.trim()) invalid.company_name = 'Company name is required'
    if (!website.trim()) invalid.company_website = 'Company website is required'
    else if (!WEBSITE_PATTERN.test(website.trim()))
      invalid.company_website = 'Please enter a valid website URL'

    setFieldErrors(invalid)
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

  const integrationIntents = onboardingIntents.filter((i) => i.group !== 'Aide features')
  const featureIntents = onboardingIntents.filter((i) => i.group === 'Aide features')
  const integrationGroups = [...new Set(integrationIntents.map((i) => i.group))]
  /* `onboard/2` *replaces* the stored slugs while `onboard/3` *appends* to
   * them, so each step posts only what it collected — sending the whole list to
   * both stores every slug twice. */
  const integrationSlugs = intents.filter((slug) =>
    integrationIntents.some((intent) => intent.slug === slug)
  )
  const featureSlugs = intents.filter((slug) =>
    featureIntents.some((intent) => intent.slug === slug)
  )
  const otherSelected = intents.includes(OnboardingIntentSlug.OTHER)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center px-5 py-4">
        <div className="flex items-center gap-2">
          <Logo />
          <Wordmark />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 pt-0">
        <div
          key={step}
          className={cn(
            'w-full animate-in duration-300 fade-in',
            step === 2 ? 'max-w-3xl' : 'max-w-3xl'
          )}
        >
          <div className="mb-6 flex items-center justify-center gap-1.5 pb-10">
            {[1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  index === step
                    ? 'w-6 bg-gray-950'
                    : index < step
                      ? 'w-4 bg-gray-950'
                      : 'w-4 bg-gray-200'
                )}
              />
            ))}
          </div>
          {step === 1 && (
            <section className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-nowrap text-gray-900">
                Welcome to the future of support
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                Let's get started, tell us about your team
              </p>

              <div className="mx-auto mt-7 flex max-w-[260px] flex-col gap-3 text-left">
                <div>
                  <Label htmlFor="full-name">Your name</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Ziyad Basheer"
                    className="mt-1"
                    aria-invalid={!!fieldErrors.name}
                  />
                  <FieldError message={fieldErrors.name} />
                </div>
                <div>
                  <Label htmlFor="job-role">Job title</Label>
                  <Input
                    id="job-role"
                    value={jobRole}
                    onChange={(event) => setJobRole(event.target.value)}
                    placeholder="VP of CX Operations"
                    className="mt-1"
                    aria-invalid={!!fieldErrors.job_role}
                  />
                  <FieldError message={fieldErrors.job_role} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="mt-1">
                    <PhoneInput
                      value={phone}
                      onChange={setPhone}
                      placeholder="416 123 4567"
                      invalid={!!fieldErrors.phone_number}
                    />
                  </div>
                  <FieldError message={fieldErrors.phone_number} />
                </div>

                <div className="mt-2 border-t border-gray-100" />
                <div>
                  <Label htmlFor="company">Company name</Label>
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Acme Corp."
                    className="mt-1"
                    aria-invalid={!!fieldErrors.company_name}
                  />
                  <FieldError message={fieldErrors.company_name} />
                </div>
                <div>
                  <Label htmlFor="website">Company website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    placeholder="www.acme.com"
                    className="mt-1"
                    aria-invalid={!!fieldErrors.company_website}
                  />
                  <FieldError message={fieldErrors.company_website} />
                  <label className="mt-2 flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Checkbox
                      checked={useWebsiteData}
                      onCheckedChange={(checked) => setUseWebsiteData(checked === true)}
                    />
                    Learn from our website
                  </label>
                </div>
                <div>
                  <Label htmlFor="agent-count">Number of agents on team</Label>
                  <Input
                    id="agent-count"
                    value={teamSize}
                    onChange={(event) => setTeamSize(event.target.value)}
                    placeholder="50"
                    className="mt-1"
                    aria-invalid={!!fieldErrors.team_size}
                  />
                  <FieldError message={fieldErrors.team_size} />
                </div>
                <div>
                  <Label htmlFor="ticket-count">Tickets per month</Label>
                  <Input
                    id="ticket-count"
                    value={volume}
                    onChange={(event) => setVolume(event.target.value)}
                    placeholder="20,000"
                    className="mt-1"
                    aria-invalid={!!fieldErrors.tickets_per_month}
                  />
                  <FieldError message={fieldErrors.tickets_per_month} />
                </div>
                <Button
                  size="lg"
                  className="mt-6 w-full rounded-[50px] pl-7 text-[13.5px]"
                  disabled={pending}
                  onClick={submitProfile}
                >
                  {pending && <Loader2 className="animate-spin" />}
                  Pick integrations
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-center text-3xl font-semibold tracking-tight text-nowrap text-gray-950">
                Which platforms do you work with?
              </h1>
              <p className="mt-2 text-center text-[14px] text-gray-500">
                Aide works where your team already does
              </p>

              <div className="mt-7 flex flex-col gap-8">
                {integrationGroups.map((group) => (
                  <div key={group}>
                    <h2 className="mb-3 text-[17px] font-medium text-gray-800">{group}</h2>
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                      {integrationIntents
                        .filter((intent) => intent.group === group)
                        .map((intent) => {
                          const selected = intents.includes(intent.slug)
                          return (
                            <IntentCard
                              key={intent.slug}
                              intent={intent}
                              selected={selected}
                              onToggle={() => toggleIntent(intent.slug)}
                            />
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={() =>
                    advance(3, () => api.post('/v1/onboard/2', { intent_slugs: integrationSlugs }))
                  }
                  disabled={pending}
                >
                  {pending && <Loader2 className="animate-spin" />}
                  Continue
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="text-center text-3xl font-semibold tracking-tight text-nowrap text-gray-950">
                How should Aide help?
              </h1>
              <p className="mt-2 text-center text-[14px] text-gray-500">
                Pick the features you want to start with. You can change this later.
              </p>

              <div className="mt-7 grid gap-6 sm:grid-cols-3">
                {featureIntents.map((intent) => {
                  const selected = intents.includes(intent.slug)
                  return (
                    <IntentCard
                      key={intent.slug}
                      intent={intent}
                      selected={selected}
                      onToggle={() => toggleIntent(intent.slug)}
                    />
                  )
                })}
              </div>

              {otherSelected && (
                <div className="mx-auto mt-6 max-w-md animate-in duration-200 fade-in">
                  <Label htmlFor="other-intent">What are you looking for?</Label>
                  <Textarea
                    id="other-intent"
                    value={otherIntent}
                    onChange={(event) => setOtherIntent(event.target.value)}
                    placeholder="e.g. Triage inbound tickets and flag the urgent ones"
                    rows={3}
                    className="mt-1.5"
                    autoFocus
                  />
                </div>
              )}

              <div className="mt-8 flex items-center justify-center gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  size="lg"
                  disabled={
                    pending || featureSlugs.length === 0 || (otherSelected && !otherIntent.trim())
                  }
                  onClick={() =>
                    /* Stage 3 is what clears `show_onboarding`, so it goes last. */
                    advance(4, () =>
                      api.post('/v1/onboard/3', {
                        intent_slugs: featureSlugs,
                        ...(otherSelected ? { other_intent: otherIntent.trim() } : {}),
                      })
                    )
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

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-[12px] text-destructive-500 first-letter:uppercase">{message}</p>
}

function IntentCard({
  intent,
  selected,
  onToggle,
}: {
  intent: OnboardingIntent
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center rounded-[20px] border p-4 transition-colors',
        selected
          ? 'border-gray-950 bg-white shadow-light'
          : 'border-black/8 bg-white shadow-light hover:border-black/12'
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-black/3 bg-white">
        {intent.icon}
      </span>
      <span className="mt-3 truncate text-[15px] font-medium text-gray-950">{intent.title}</span>
      <span className="mt-1 text-center text-[12px] tracking-[0.01em] text-gray-400">
        {intent.description}
      </span>
      <span
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
          selected ? 'border-transparent bg-gray-950 text-white' : 'border-black/8 text-gray-600'
        )}
      >
        {selected && <Check className="size-3" />}
        {selected ? 'Selected' : 'Select'}
      </span>
    </button>
  )
}
