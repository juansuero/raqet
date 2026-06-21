'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { currentPlayer, memoryItems, type MemoryItem } from '@/lib/data'
import { loadMemories, loadPlayer, updateMemoryItem, updateMemoryStatus } from '@/lib/api'
import { CheckCircle, XCircle, Archive, Save } from 'lucide-react'

type MemoryStatus = 'confirmed' | 'pending' | 'archived' | 'incorrect'

export default function MemoryPage() {
  const [items, setItems] = useState(memoryItems)
  const [player, setPlayer] = useState(currentPlayer)
  const [filter, setFilter] = useState<'all' | 'tactical' | 'technical' | 'mental' | 'physical' | 'preference'>('all')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([loadMemories(), loadPlayer()])
      .then(([loadedMemories, loadedPlayer]) => {
        setItems(loadedMemories ?? [])
        if (loadedPlayer) setPlayer(loadedPlayer)
        setError('')
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Player memory could not load.'))
  }, [])

  const handleStatusChange = async (id: string, status: MemoryStatus) => {
    setError('')
    try {
      const saved = await updateMemoryStatus(id, status)
      if (!saved) throw new Error('Memory update failed.')
      setItems((prev) => prev.map((item) => (item.id === id ? saved : item)))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Memory update failed.')
    }
  }

  const handleContentSave = async (item: MemoryItem) => {
    const content = (editing[item.id] ?? item.content).trim()
    if (!content) return
    setError('')
    try {
      const saved = await updateMemoryItem({ id: item.id, content })
      if (!saved) throw new Error('Memory update failed.')
      setItems((prev) => prev.map((memory) => (memory.id === item.id ? saved : memory)))
      setEditing((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Memory update failed.')
    }
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter)

  const categories = ['all', 'tactical', 'technical', 'mental', 'physical', 'preference'] as const

  return (
    <AppShell
      title="Player Memory"
      subtitle="What the AI remembers about you over time"
    >
      <PageHeader
        title="Player Memory"
        subtitle={`${items.filter((i) => i.status === 'confirmed' || i.status === 'pending').length} active memories`}
      />

      <div className="readable-panel bg-accent-light border border-accent/20 rounded-card p-4 mb-6">
        <p className="max-w-[54ch] text-sm text-foreground leading-relaxed">
          AI suggestions are reviewable notes, not facts. Confirm only the memories that accurately describe your game, preferences, recovery, or training context.
        </p>
      </div>
      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      {/* Identity Summary */}
      <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
            {player.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">{player.name}</h2>
            <p className="text-sm text-muted">
              UTR {player.utrSingles ?? 'not set'} singles · WTN {player.wtnSingles ?? 'not set'} singles
            </p>
            <p className="mt-2 max-w-[54ch] text-sm text-foreground leading-relaxed">
              {player.profileSummary || 'Complete your player profile so Raqet can build useful context over time.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {player.strengths.map((s) => (
                <span key={s} className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
              filter === cat
                ? 'bg-accent text-white'
                : 'bg-surface border border-border text-muted hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Memory Items */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`readable-panel bg-surface border rounded-card shadow-card p-5 transition-opacity ${
              item.status === 'incorrect' ? 'border-danger/30 opacity-60' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-medium tracking-label uppercase px-2 py-0.5 rounded-full bg-background border border-border text-muted">
                    {item.category}
                  </span>
                  <span
                    className={`text-[10px] font-medium tracking-label uppercase px-2 py-0.5 rounded-full ${
                      item.status === 'confirmed'
                        ? 'bg-success/10 text-success'
                        : item.status === 'pending'
                        ? 'bg-warning/10 text-warning'
                        : item.status === 'incorrect'
                        ? 'bg-danger/10 text-danger'
                        : 'bg-muted/10 text-muted'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <textarea
                  value={editing[item.id] ?? item.content}
                  onChange={(event) => setEditing((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  rows={3}
                  className="w-full max-w-[54ch] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-70"
                  disabled={item.status === 'incorrect'}
                />
                <p className="text-xs text-muted mt-2">Last updated: {item.updatedAt.split('T')[0]}</p>
              </div>
            </div>

            {item.status !== 'archived' && item.status !== 'incorrect' && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <button
                  onClick={() => handleStatusChange(item.id, 'confirmed')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    item.status === 'confirmed'
                      ? 'bg-success/10 text-success'
                      : 'hover:bg-background text-muted'
                  }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  Confirm
                </button>
                <button
                  onClick={() => handleStatusChange(item.id, 'incorrect')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-background transition-colors"
                >
                  <XCircle className="w-3 h-3" />
                  Discard
                </button>
                <button
                  onClick={() => handleContentSave(item)}
                  disabled={(editing[item.id] ?? item.content).trim() === item.content}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-background transition-colors disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  Save edit
                </button>
                <button
                  onClick={() => handleStatusChange(item.id, 'archived')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:bg-background transition-colors"
                >
                  <Archive className="w-3 h-3" />
                  Archive
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  )
}
