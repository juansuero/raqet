'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { loadSessions } from '@/lib/api'
import type { Session } from '@/lib/data'
import { CalendarDays, CheckCircle2, Plus } from 'lucide-react'

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    loadSessions().then((loaded) => setSessions(loaded ?? []))
  }, [])

  const planned = useMemo(() => sessions
    .filter((session) => session.status === 'planned')
    .sort((a, b) => new Date(a.scheduledStartAt || a.date).getTime() - new Date(b.scheduledStartAt || b.date).getTime()), [sessions])
  const completed = sessions.filter((session) => session.status !== 'planned').length

  return (
    <AppShell title="Schedule" subtitle="Plan future sessions and pre-session focus">
      <PageHeader
        title="Schedule"
        subtitle={`${planned.length} planned sessions - ${completed} completed logs`}
        action={
          <Link href="/sessions/new?mode=planned" className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90">
            <Plus className="h-4 w-4" />
            Schedule Session
          </Link>
        }
      />

      {planned.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-6 text-center shadow-card">
          <CalendarDays className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm text-muted">No planned sessions yet.</p>
          <Link href="/sessions/new?mode=planned" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">
            <Plus className="h-4 w-4" />
            Schedule Session
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {planned.map((session) => (
            <article key={session.id} className="rounded-card border border-border bg-surface p-5 shadow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-foreground">{session.title}</h2>
                    {session.calendarEventId && <span className="rounded-full bg-accent-light px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-accent">Calendar</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {session.scheduledStartAt ? new Date(session.scheduledStartAt).toLocaleString() : session.date}
                    {session.location ? ` - ${session.location}` : ''}
                  </p>
                  {session.mainFocus && <p className="mt-3 text-sm text-foreground">{session.mainFocus}</p>}
                  {session.preSessionFocus && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-background p-3 text-sm text-muted">{session.preSessionFocus}</pre>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/sessions/new?edit=${session.id}`} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background">
                    Edit
                  </Link>
                  <Link href={`/sessions/new?edit=${session.id}`} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90">
                    <CheckCircle2 className="h-4 w-4" />
                    Complete
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  )
}
