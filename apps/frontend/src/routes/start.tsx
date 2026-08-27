import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo, Wordmark } from '@/components/logo'
import { onboardingIntents, type OnboardingIntentSlugValue } from '@/features/onboarding/actions'
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

function StartPage() {
  const me = Route.useLoaderData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(Math.min(Math.max(me.team?.onboarding_stage ?? 1, 1), 3))
  const [pending, setPending] = useState(false)

  const [companyName, setCompanyName] = useState(me.team?.name ?? '')
  const [website, setWebsite] = useState(me.team?.website ?? '')
  const [intents, setIntents] = useState<OnboardingIntentSlugValue[]>(
    (me.team?.onboarding_intent_slugs ?? []) as OnboardingIntentSlugValue[]
  )
  const [teamSize, setTeamSize] = useState(me.team?.team_size ?? '')
  const [volume, setVolume] = useState(me.team?.tickets_per_month ?? '')

  const toggleIntent = (slug: OnboardingIntentSlugValue) =>
    setIntents((current) =>
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug]
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
      setStep(to)
    } catch {
      toast.error('Could not save that step. Try again.')
    } finally {
      setPending(false)
    }
  }

  const groups = [...new Set(onboardingIntents.map((intent) => intent.group))]

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
                Tell us about your company
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                We use your website to learn your products and policies.
              </p>

              <div className="mt-7 flex max-w-md flex-col gap-4">
                <div>
                  <Label htmlFor="company">Company name</Label>
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    className="mt-1.5"
                    placeholder="Northwind Outdoors"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    className="mt-1.5"
                    placeholder="https://yourcompany.com"
                  />
                </div>
              </div>

              <Button
                size="lg"
                className="mt-6"
                disabled={pending || !companyName.trim()}
                onClick={() =>
                  advance(2, () => api.post('/v1/onboard/1', { name: companyName, website }))
                }
              >
                {pending && <Loader2 className="animate-spin" />}
                Continue
              </Button>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-gray-950">
                What do you want Aide to do?
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                Pick everything that applies. You can change this later.
              </p>

              <div className="mt-7 flex flex-col gap-6">
                {groups.map((group) => (
                  <div key={group}>
                    <p className="mb-2 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
                      {group}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {onboardingIntents
                        .filter((intent) => intent.group === group)
                        .map((intent) => {
                          const selected = intents.includes(intent.slug)
                          return (
                            <button
                              key={intent.slug}
                              type="button"
                              onClick={() => toggleIntent(intent.slug)}
                              aria-pressed={selected}
                              className={cn(
                                'flex items-start gap-3 rounded-[8px] border p-3 text-left transition-colors',
                                selected
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
                              {selected && (
                                <Check className="mt-0.5 size-4 shrink-0 text-gray-950" />
                              )}
                            </button>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  size="lg"
                  disabled={pending || intents.length === 0}
                  onClick={() =>
                    advance(3, () => api.post('/v1/onboard/2', { intent_slugs: intents }))
                  }
                >
                  {pending && <Loader2 className="animate-spin" />}
                  Continue
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em] text-gray-950">
                How big is your support load?
              </h1>
              <p className="mt-2 text-[14px] text-gray-500">
                This sets your defaults. Nothing here is locked in.
              </p>

              <div className="mt-7 flex flex-col gap-5">
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

              <div className="mt-7 flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  size="lg"
                  disabled={pending || !teamSize || !volume}
                  onClick={() =>
                    advance(4, () =>
                      api.post('/v1/onboard/3', {
                        team_size: teamSize,
                        tickets_per_month: volume,
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
