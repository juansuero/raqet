import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Brain, CalendarDays, CheckCircle, MessageSquareText, Mic2, ShieldCheck, Target, Trophy } from 'lucide-react'
import { RecoveryRedirect } from '@/components/RecoveryRedirect'

const heroImage =
  '/brand/raqet-hero-grass-court-painted-v3.webp'
const playerProfileImage =
  '/brand/raqet-profile-court-paint.webp'
const selfHostingImage =
  '/brand/raqet-beta-gate-paint.webp'
const footerImage =
  '/brand/raqet-footer-still-life-paint.webp'

const ritualSteps = [
  ['01', 'Speak while the session is still fresh', 'Capture the honest version: what shifted, what broke, what you felt under pressure.'],
  ['02', 'Review the debrief', 'Transcripts, takeaways, and memory suggestions stay editable before they shape your profile.'],
  ['03', 'Let approved memories compound', 'Raqet remembers only what you approve, so your profile gets sharper without becoming noisy.'],
]

const productDetails = [
  ['Voice debriefs', 'Record or upload a note after a match or practice. Raqet turns it into a transcript, takeaways, and a next focus.'],
  ['Session journal', 'Log training days, matches, scores, surfaces, energy, confidence, notes, tags, and what you want to test next.'],
  ['Player profile', 'Build a living profile from onboarding answers, rating context, recurring patterns, and approved memories.'],
  ['Memory review', 'AI can suggest profile updates after a session, but you edit and approve them before they become permanent.'],
  ['Opponent memory', 'Save recurring opponents, matchup notes, scores, and tactical reminders so rematches start from context.'],
  ['Local export', 'Keep a clean export of your profile, sessions, memories, rating history, and tournament data.'],
]

const capabilityTracks = [
  {
    icon: Mic2,
    title: 'After-session capture',
    body: 'Fast voice debriefs for the honest post-court version: what worked, what failed, how you felt, and what deserves attention next.',
  },
  {
    icon: CalendarDays,
    title: 'Planning loop',
    body: 'Schedule future sessions, write a pre-session focus, and optionally sync planned sessions to Google Calendar from Settings.',
  },
  {
    icon: Target,
    title: 'Opponent context',
    body: 'Track opponent styles, match situations, tactical notes, and patterns so every rematch starts from memory instead of guesswork.',
  },
  {
    icon: Trophy,
    title: 'Competition record',
    body: 'Log tournament runs, match results, surfaces, UTR, WTN, custom rankings, and progress signals without forcing team workflows.',
  },
  {
    icon: Brain,
    title: 'Memory review',
    body: 'Approve only the patterns worth remembering, so your player profile gets sharper without turning every note into permanent context.',
  },
  {
    icon: MessageSquareText,
    title: 'Private coach chat',
    body: 'Ask Raqet about recent sessions, rankings, tournament prep, opponents, or what your approved profile suggests.',
  },
]

const playerSignals = [
  'Strengths and patterns that actually show up under pressure',
  'Recurring weaknesses, triggers, and match situations',
  'UTR singles, UTR doubles, WTN, and rating context',
  'Physical, mental, tactical, and lifestyle notes in one place',
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[oklch(97%_0.012_132)] text-[oklch(18%_0.03_145)]">
      <RecoveryRedirect />
      <section className="relative h-[100svh] overflow-hidden">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 scale-[1.03] object-cover object-[54%_center] motion-safe:animate-[heroDrift_18s_ease-out_forwards] md:object-center"
        />
        <div className="absolute inset-0 bg-[oklch(13%_0.04_145_/_0.58)]" />

        <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10">
          <Link href="/" className="flex min-h-11 items-center gap-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[oklch(98%_0.01_132)] shadow-[0_12px_40px_oklch(5%_0.02_145_/_0.28)]">
              <Image src="/brand/raqet-logo-imagegen.png" alt="Raqet" width={38} height={38} className="h-9 w-9 object-cover" priority />
            </span>
            <span className="font-display text-xl font-bold uppercase tracking-label text-[oklch(98%_0.012_132)]">
              Raqet
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="hidden text-[oklch(91%_0.02_132)] hover:text-[oklch(99%_0.01_132)] sm:inline">
              Privacy
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[oklch(97%_0.018_132)] px-4 py-2 font-semibold text-[oklch(18%_0.035_145)] shadow-[0_10px_30px_oklch(7%_0.04_145_/_0.25)] transition-transform hover:-translate-y-0.5"
            >
              Open app
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <div className="relative z-10 flex h-[calc(100svh-84px)] items-center px-5 pb-10 pt-14 md:items-start md:px-10 md:pt-[clamp(7rem,18svh,10rem)] lg:items-center lg:pt-12">
          <div className="grid w-full items-center gap-14 lg:grid-cols-[minmax(0,720px)_minmax(340px,440px)] xl:gap-20">
            <div className="max-w-[760px]">
              <h1 className="hero-heading max-w-[10ch] text-[clamp(3rem,14vw,5.7rem)] uppercase leading-[0.94] tracking-display text-[oklch(98%_0.012_132)] sm:max-w-[11ch] md:text-[clamp(4rem,7vw,7rem)] md:leading-[0.9]">
                Your smart tennis journal.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[oklch(93%_0.018_132)] md:text-lg">
                Raqet helps tennis players turn match and training debriefs into a private improvement profile, recurring patterns, and a clear next focus.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[oklch(58%_0.17_142)] px-6 py-3 text-sm font-bold text-[oklch(99%_0.012_132)] shadow-[0_18px_55px_oklch(16%_0.08_145_/_0.4)] transition-transform hover:-translate-y-0.5"
                >
                  Open app
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#ritual"
                  className="inline-flex items-center justify-center rounded-full border border-[oklch(88%_0.03_132_/_0.42)] px-6 py-3 text-sm font-bold text-[oklch(98%_0.012_132)] backdrop-blur-sm transition-colors hover:bg-[oklch(98%_0.012_132_/_0.08)]"
                >
                  See how it works
                </a>
              </div>
            </div>

            <aside className="hidden self-start border-y border-[oklch(90%_0.03_132_/_0.34)] bg-[oklch(12%_0.035_145_/_0.36)] py-5 text-[oklch(96%_0.014_132)] shadow-[0_18px_70px_oklch(5%_0.04_145_/_0.24)] backdrop-blur-sm lg:mt-24 lg:block">
              <div className="flex items-center justify-between border-b border-[oklch(90%_0.03_132_/_0.24)] px-5 pb-4">
                <p className="text-xs font-semibold uppercase tracking-label text-[oklch(87%_0.1_105)]">Post-practice review</p>
                <p className="font-mono text-xs text-[oklch(82%_0.025_132)]">Clay practice - 90 min</p>
              </div>

              <div className="divide-y divide-[oklch(90%_0.03_132_/_0.18)]">
                {[
                  ['Session note', 'Backhand timing got rushed once rallies went long.'],
                  ['Memory suggestion', 'Under pressure, I recover late after wide balls to the forehand side.'],
                  ['Next focus', 'Reset court position faster before changing direction.'],
                ].map(([label, body]) => (
                  <div key={label} className="grid grid-cols-[96px_1fr] gap-4 px-5 py-4">
                    <p className="text-[0.66rem] font-semibold uppercase tracking-label text-[oklch(76%_0.04_132)]">{label}</p>
                    <p className="text-sm leading-6 text-[oklch(93%_0.018_132)]">{body}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 border-t border-[oklch(90%_0.03_132_/_0.24)] px-5 pt-4">
                <span className="h-2 w-2 rounded-full bg-[oklch(84%_0.14_105)]" />
                <p className="text-xs font-semibold uppercase tracking-label text-[oklch(84%_0.035_132)]">Review before saving</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-display text-[clamp(3rem,12vw,4.4rem)] uppercase leading-[1.04] tracking-label text-foreground">
              A record of how you actually play.
            </h2>
            <p className="mt-6 max-w-md text-base leading-8 text-muted">
              Raqet is for players who want a clear solo system for improving their game. It turns session insights, voice notes, ratings, opponents, and reflections into a profile you can use every time you step on the court.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {productDetails.map(([title, body]) => (
              <article key={title} className="rounded-[18px] border border-border bg-surface p-6 shadow-card">
                <h3 className="font-display text-2xl font-bold uppercase leading-[1.12] tracking-label text-foreground">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ritual" className="relative px-5 py-16 md:px-10 md:py-20">
        <div className="mx-auto mb-16 max-w-6xl">
          <div className="mb-10 max-w-2xl">
            <h2 className="font-display text-[clamp(2.8rem,12vw,4rem)] uppercase leading-[1.04] tracking-label text-foreground">
              Built around one player's improvement loop.
            </h2>
            <p className="mt-5 text-base leading-8 text-muted">
              Raqet is focused on one habit: log three real sessions, review the patterns, and decide what deserves to become part of your player profile.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilityTracks.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-[18px] border border-border bg-surface p-6 shadow-card">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-accent-light text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl uppercase leading-[1.15] tracking-label text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <h2 className="max-w-2xl font-display text-[clamp(3rem,13vw,3.75rem)] uppercase leading-[1.08] tracking-label text-foreground md:text-6xl md:leading-[1.02]">
                Stop forgetting what you need to work on.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ritualSteps.map(([number, title, body]) => (
              <article key={number} className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-card transition-transform hover:-translate-y-1">
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-cover bg-bottom opacity-95"
                  style={{ backgroundImage: "url('/brand/raqet-card-paint-strip.webp')" }}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-[oklch(100%_0_0_/_0.42)]" />
                <div className="relative flex min-h-[52%] shrink-0 p-5 md:p-6">
                  <div className="absolute right-4 top-4 font-mono text-4xl font-semibold text-[oklch(88%_0.045_132)] transition-transform group-hover:scale-110">
                    {number}
                  </div>
                  <h3 className="max-w-[13rem] self-start pr-12 font-display text-xl uppercase leading-[1.14] tracking-label text-foreground md:text-2xl">
                    {title}
                  </h3>
                </div>
                <div className="relative flex flex-1 items-end p-5 pt-3 md:p-6 md:pt-3">
                  <p className="text-sm leading-6 text-muted md:leading-7">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-10 md:pb-20">
        <div className="mx-auto grid max-w-6xl gap-0 overflow-hidden border-y border-border lg:grid-cols-[0.95fr_1.05fr]">
          <div className="p-7 md:p-10">
            <h2 className="font-display text-[clamp(2.7rem,11vw,4rem)] uppercase leading-[1.06] tracking-label text-foreground">
              Your player profile gets sharper over time.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted">
              Onboarding starts the profile with tennis-specific and general questions. After that, session debriefs can suggest new memories, but nothing permanent is written until you approve it.
            </p>
          </div>

          <div
            className="relative border-t border-border bg-[oklch(94%_0.014_132)] bg-cover bg-bottom p-7 md:p-10 lg:border-l lg:border-t-0"
            style={{ backgroundImage: `url(${playerProfileImage})` }}
          >
            <div className="absolute inset-0 bg-[oklch(96%_0.012_132_/_0.7)]" />
            <div className="relative flex min-h-full flex-col justify-center">
              <div className="border-y border-[oklch(73%_0.035_132)]">
                {playerSignals.map((signal, index) => (
                  <div key={signal} className="grid grid-cols-[72px_1fr] border-b border-[oklch(73%_0.035_132)] last:border-b-0">
                    <div className="flex items-center justify-center border-r border-[oklch(73%_0.035_132)] py-6">
                      <span className="font-mono text-sm font-semibold text-accent">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-4 bg-[oklch(100%_0_0_/_0.48)] px-5 py-6">
                      <CheckCircle className="h-5 w-5 shrink-0 text-accent" />
                      <p className="text-base leading-7 text-foreground">{signal}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-10 md:pb-24">
        <div
          className="relative mx-auto grid max-w-6xl overflow-hidden border-y border-border bg-cover bg-center lg:grid-cols-[0.9fr_1.1fr]"
          style={{ backgroundImage: `url(${selfHostingImage})` }}
        >
          <div className="absolute inset-0 bg-[oklch(99%_0.006_132_/_0.84)]" />
          <div className="relative p-7 md:p-10">
            <ShieldCheck className="h-7 w-7 text-accent" />
            <h2 className="mt-8 max-w-xl font-display text-[clamp(2.8rem,10vw,4.5rem)] uppercase leading-[1.02] tracking-label text-foreground">
              Raqet is self-hostable by default.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted">
              Clone it, initialize SQLite, and run a solo tennis journal without hosted auth, invite gates, managed analytics, or a Supabase project.
            </p>
          </div>

          <div className="relative flex items-end border-t border-border bg-[oklch(100%_0_0_/_0.56)] p-7 md:p-10 lg:border-l lg:border-t-0">
            <a
              href="/self-hosting"
              className="inline-flex items-center justify-center rounded-full border border-border bg-white/70 px-5 py-3 text-sm font-bold text-foreground transition-transform hover:-translate-y-0.5"
            >
              Read setup notes
            </a>
          </div>
        </div>
      </section>

      <footer
        className="relative overflow-hidden border-t border-border bg-cover bg-bottom px-5 py-10 md:px-10"
        style={{ backgroundImage: `url(${footerImage})` }}
      >
        <div className="absolute inset-0 bg-[oklch(98%_0.01_132_/_0.74)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <p className="text-sm text-muted">Solo local app. SQLite by default. Export in-app.</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/privacy" className="text-muted hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="text-muted hover:text-foreground">Terms</Link>
            <Link href="/self-hosting" className="text-muted hover:text-foreground">Self-hosting</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
