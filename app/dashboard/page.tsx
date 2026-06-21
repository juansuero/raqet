'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { StatCard, StatCardSkeleton } from '@/components/StatCard'
import { EmptyState } from '@/components/EmptyState'
import { loadClips, loadMemories, loadPlayer, loadSessions } from '@/lib/api'
import type { Clip, MemoryItem, Player, Session } from '@/lib/data'
import { BookOpen, Calendar, FileText, Plus, Target, Video } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [player, setPlayer] = useState<Player | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([loadPlayer(), loadSessions(), loadClips(), loadMemories()])
      .then(([loadedPlayer, loadedSessions, loadedClips, loadedMemories]) => {
        setPlayer(loadedPlayer)
        setSessions(loadedSessions ?? [])
        setClips(loadedClips ?? [])
        setMemories(loadedMemories ?? [])
        setLoadError('')
        if (loadedPlayer && !loadedPlayer.profileMarkdown) router.replace('/onboarding')
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Dashboard could not load.'))
      .finally(() => setLoading(false))
  }, [router])

  const confirmedMemories = memories.filter((memory) => memory.status === 'confirmed')
  const pendingMemories = memories.filter((memory) => memory.status === 'pending')

  return (
    <AppShell
      title="Dashboard"
      subtitle={player?.profileMarkdown ? `Welcome back, ${player.name.split(' ')[0]}.` : 'Build your player profile to start.'}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard title="Sessions" value={sessions.length} subtitle="logged" icon={<BookOpen className="w-4 h-4" />} />
            <StatCard title="Clips" value={clips.length} subtitle="local" icon={<Video className="w-4 h-4" />} />
            <StatCard title="Memories" value={confirmedMemories.length} subtitle="approved" icon={<Target className="w-4 h-4" />} />
            <StatCard title="Pending" value={pendingMemories.length} subtitle="memory suggestions" icon={<Calendar className="w-4 h-4" />} />
          </>
        )}
      </div>

      {loadError ? (
        <EmptyState title="Dashboard could not load" description={loadError} />
      ) : loading ? (
        <div className="grid animate-pulse gap-6 lg:grid-cols-3">
          <div className="rounded-card border border-border bg-surface p-5 shadow-card lg:col-span-2">
            <div className="h-5 w-36 rounded bg-border" />
            <div className="mt-5 h-4 w-48 rounded bg-border" />
            <div className="mt-3 h-4 w-64 max-w-full rounded bg-border" />
            <div className="mt-5 h-4 w-full rounded bg-border" />
            <div className="mt-2 h-4 w-3/4 rounded bg-border" />
          </div>
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <div className="h-5 w-32 rounded bg-border" />
            <div className="mt-5 space-y-4">
              <div className="h-4 w-full rounded bg-border" />
              <div className="h-4 w-5/6 rounded bg-border" />
              <div className="h-4 w-2/3 rounded bg-border" />
            </div>
          </div>
        </div>
      ) : !player?.profileMarkdown ? (
        <EmptyState
          title="Start with your player profile"
          description="Raqet works best when it knows your game, training context, goals, and feedback style."
          action={
            <Link href="/onboarding" className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium">
              <FileText className="w-4 h-4" />
              Build Player Profile
            </Link>
          }
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="Log your first session"
          description="Add a training session or match. You can write notes or upload a voice debrief."
          action={
            <Link href="/sessions/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
              New Session
            </Link>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-4">
              Latest Session
            </h2>
            <Link href={`/sessions/${sessions[0].id}`} className="block hover:text-accent transition-colors">
              <p className="font-semibold text-foreground">{sessions[0].title}</p>
              <p className="text-sm text-muted mt-1">
                {sessions[0].date} · {sessions[0].surface || 'surface not set'} · {sessions[0].durationMinutes} min
              </p>
              {sessions[0].aiSummary && (
                <p className="text-sm text-muted mt-3 leading-relaxed">{sessions[0].aiSummary}</p>
              )}
            </Link>
          </div>

          <div className="bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-4">
              Player Summary
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Style</span>
                <span className="font-medium text-foreground text-right">{player.playingStyle || 'Not set'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Goal</span>
                <span className="font-medium text-foreground text-right">{player.currentGoal || 'Not set'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">UTR</span>
                <span className="font-medium text-foreground">{player.utrSingles ?? 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
