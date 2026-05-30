export default function SelfHostingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-foreground">
      <h1 className="font-display text-4xl font-bold uppercase tracking-label">Self-hosting Notes</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>Raqet runs as a single-player local app by default. No hosted auth, invite gate, team workspace, managed usage limit, Sentry, Vercel Analytics, or Supabase project is required.</p>
        <p>SQLite is the default persistence layer. Initialize it with npm run db:init before starting the app.</p>
        <p>AI features are optional. Without an AI key, the journal, profile, opponents, tournaments, stats, memory review, settings, and export flows still run locally.</p>
        <p>Raw audio is not stored by Raqet after processing. If an AI provider is configured, audio is sent to that provider for transcription or debrief generation.</p>
      </div>
    </main>
  )
}
