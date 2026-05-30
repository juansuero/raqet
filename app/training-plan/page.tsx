'use client'

import Link from 'next/link'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'

export default function TrainingPlanPage() {
  return (
    <AppShell title="Training Plan" subtitle="Turn reviewed sessions into focused practice">
      <PageHeader title="Training Plan" subtitle="A weekly plan appears after Raqet has enough confirmed profile memory to work from." />

      <div className="readable-panel rounded-card border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 flex-shrink-0 text-accent" />
          <h2 className="font-display text-xl font-bold text-foreground">No training plan yet</h2>
        </div>
        <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-muted">
          Keep logging matches, practice sessions, energy, confidence, and debrief notes. Once your Player Profile has enough confirmed memories, Raqet can turn them into a focused practice week.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Link
            href="/sessions/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Log a Session
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/memory"
            className="inline-flex items-center justify-center px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background transition-colors"
          >
            Review Profile Memory
          </Link>
        </div>
      </div>
    </AppShell>
  )
}
