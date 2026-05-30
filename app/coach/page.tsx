'use client'

import { useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { deleteCoachConversation, loadCoachMessages, loadPlayer, savePlayer, sendCoachMessage } from '@/lib/api'
import type { CoachMessage, CoachPreferences, Player } from '@/lib/data'
import { Bot, History, Save, Send, Trash2 } from 'lucide-react'

const defaultCoachPreferences: CoachPreferences = {
  completed: false,
  coachName: 'Raqet',
  style: 'direct',
  detailLevel: 'brief',
  encouragement: 'encouraging',
}

function cleanContent(content: string) {
  return content
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function CoachBubble({ message }: { message: CoachMessage }) {
  const content = cleanContent(message.content)
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] px-4 py-3 text-sm leading-6 ${
          message.role === 'user'
            ? 'rounded-card bg-accent text-white'
            : 'border-l-2 border-accent/30 text-foreground'
        }`}
      >
        <div className="space-y-2">
          {lines.map((line, index) => (
            line.startsWith('- ') ? (
              <div key={`${message.id}-${index}`} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <p>{line.slice(2)}</p>
              </div>
            ) : (
              <p key={`${message.id}-${index}`}>{line}</p>
            )
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CoachPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [preferences, setPreferences] = useState<CoachPreferences>(defaultCoachPreferences)
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPlayer().then((loaded) => {
      setPlayer(loaded)
      setPreferences(loaded?.coachPreferences ?? defaultCoachPreferences)
    })
    loadCoachMessages()
      .then((loaded) => setMessages(loaded ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Coach messages load failed'))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const firstName = player?.name?.split(' ')[0] || 'there'
  const coachName = preferences.coachName || 'Raqet'
  const needsSetup = !preferences.completed

  const savePreferences = async () => {
    if (!player) return
    setSavingPreferences(true)
    setError('')

    const nextPreferences = {
      ...preferences,
      coachName: preferences.coachName.trim() || 'Raqet',
      completed: true,
    }

    const saved = await savePlayer({
      ...player,
      coachPreferences: nextPreferences,
      profileInterviewAnswers: {
        ...(player.profileInterviewAnswers ?? {}),
        coachPreferences: nextPreferences,
      },
    })

    if (saved) {
      setPlayer(saved)
      setPreferences(saved.coachPreferences ?? nextPreferences)
    } else {
      setError('Could not save coach preferences.')
    }

    setSavingPreferences(false)
  }

  const submit = async () => {
    const message = draft.trim()
    if (!message) return

    const optimisticUser: CoachMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }
    const pendingAssistant: CoachMessage = {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: `${coachName} is reading your context...`,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticUser, pendingAssistant])
    setSending(true)
    setError('')
    setDraft('')

    try {
      const result = await sendCoachMessage(message)
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== optimisticUser.id && item.id !== pendingAssistant.id),
        result.userMessage,
        result.assistantMessage,
      ].filter(Boolean))
      if ('warning' in result && typeof result.warning === 'string') setError(result.warning)
    } catch (sendError) {
      setMessages((prev) => prev.filter((item) => item.id !== pendingAssistant.id))
      setDraft(message)
      setError(sendError instanceof Error ? sendError.message : 'Coach response failed')
    } finally {
      setSending(false)
    }
  }

  const deleteConversation = async (messageId: string) => {
    setDeletingId(messageId)
    setError('')

    try {
      const result = await deleteCoachConversation(messageId)
      setMessages((prev) => prev.filter((message) => !result.deletedIds.includes(message.id)))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete conversation.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <AppShell title="Coach" subtitle={`Ask ${coachName} about your game, ${firstName}.`}>
      <PageHeader
        title="Coach"
        subtitle="A private coach chat that uses your Player Profile, sessions, rankings, memories, opponents, and tournament matches."
      />

      <div className="readable-panel mb-6 rounded-card border border-accent/20 bg-accent-light p-4 text-sm leading-6 text-muted shadow-card">
        <span className="font-medium text-foreground">Early AI:</span> Coach is still in a very early stage. Treat its advice as a useful training prompt, not as final truth.
      </div>

      {needsSetup && (
        <div className="readable-panel mb-6 rounded-card border border-accent/20 bg-accent-light p-5 shadow-card">
          <h2 className="font-display text-lg font-bold text-foreground">Set up your coach</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Choose how the coach should talk to you. This will shape future answers.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-card border border-border bg-surface shadow-card">
          <div className="max-h-[62vh] min-h-[420px] overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-accent-light text-accent">
                  <Bot className="h-5 w-5" />
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-foreground">What should we work on, {firstName}?</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  Ask about match patterns, a training focus, tournament prep, opponent style, rankings, or what your recent sessions suggest.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <CoachBubble key={message.id} message={message} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            {error && <p className="mb-3 rounded-lg bg-danger/5 p-3 text-sm text-danger">{error}</p>}
            <div className="flex gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    submit()
                  }
                }}
                rows={2}
                placeholder={`Ask ${coachName} what to focus on next, ${firstName}...`}
                className="min-h-[52px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={submit}
                disabled={sending || !draft.trim()}
                className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold text-foreground">Coach Setup</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Coach Name</label>
                <input
                  value={preferences.coachName}
                  onChange={(event) => setPreferences((prev) => ({ ...prev, coachName: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Style</label>
                <select
                  value={preferences.style}
                  onChange={(event) => setPreferences((prev) => ({ ...prev, style: event.target.value as CoachPreferences['style'] }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  <option value="direct">Direct</option>
                  <option value="supportive">Supportive</option>
                  <option value="tactical">Tactical</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Detail</label>
                  <select
                    value={preferences.detailLevel}
                    onChange={(event) => setPreferences((prev) => ({ ...prev, detailLevel: event.target.value as CoachPreferences['detailLevel'] }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="brief">Brief</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Tone</label>
                  <select
                    value={preferences.encouragement}
                    onChange={(event) => setPreferences((prev) => ({ ...prev, encouragement: event.target.value as CoachPreferences['encouragement'] }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                  >
                    <option value="encouraging">Encouraging</option>
                    <option value="calm">Calm</option>
                    <option value="blunt">Blunt</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={savePreferences}
                disabled={savingPreferences || !player}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingPreferences ? 'Saving...' : 'Save Coach Setup'}
              </button>
            </div>
          </section>

          <section className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold text-foreground">Coach Context</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="leading-6 text-muted">
                {coachName} answers from your saved profile, approved memories, sessions, opponents, stats, and tournaments.
              </p>
              <div className="rounded-lg bg-background p-3">
                <p className="text-xs font-medium uppercase tracking-label text-muted">Current goal</p>
                <p className="mt-1 text-foreground">{player?.currentGoal || 'Add a goal in your Player Profile.'}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted" />
                <h2 className="font-display text-sm font-bold uppercase tracking-label text-foreground">Conversation History</h2>
              </div>
              <div className="mt-3 space-y-2">
                {messages.filter((message) => message.role === 'user').length === 0 ? (
                  <p className="text-sm leading-6 text-muted">Your coach questions will appear here.</p>
                ) : (
                  messages
                    .filter((message) => message.role === 'user')
                    .slice(-6)
                    .reverse()
                    .map((message) => (
                      <div key={message.id} className="rounded-lg bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">{cleanContent(message.content).slice(0, 90)}</p>
                            <p className="mt-1 text-xs text-muted">{new Date(message.createdAt).toLocaleDateString()}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteConversation(message.id)}
                            disabled={deletingId === message.id || message.id.startsWith('local-')}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                            aria-label="Delete conversation"
                            title="Delete conversation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}
