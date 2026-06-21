'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { AiActionLogCard } from '@/components/AiActionLog'
import { UserCircle, FileText, Shield, Download, ChevronRight, Brain, Loader2, Upload } from 'lucide-react'

const settingsGroups = [
  {
    title: 'Profile',
    items: [
      { label: 'Profile Information', icon: UserCircle, href: '/profile' },
      { label: 'Player Profile Interview', icon: FileText, href: '/onboarding' },
      { label: 'Privacy', icon: Shield, href: '/privacy' },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'Export Data', icon: Download, href: '/api/export' },
    ],
  },
]

type ImportResult = {
  ok: true
  counts: Array<{ name: string; value: number }>
  skipped: Record<string, number>
}

export default function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [aiConfig, setAiConfig] = useState<{
    configured: boolean
    provider: string | null
    model: string | null
    missingEnv: string[]
    supportsVideoAnalysis: boolean
  } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    fetch('/api/ai/config').then((response) => response.json()).then(setAiConfig).catch(() => null)
  }, [])

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const confirmed = window.confirm('Import this Raqet export into the local database? Existing records with the same IDs will be updated.')
    if (!confirmed) return

    setImporting(true)
    setImportStatus('')
    setImportError('')
    try {
      const data = JSON.parse(await file.text())
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : 'Import failed')
      }
      const result = await response.json() as ImportResult
      const imported = result.counts.filter((item) => item.value > 0).map((item) => `${item.value} ${item.name}`).join(', ')
      setImportStatus(imported ? `Imported ${imported}.` : 'Import completed. No records were found in the file.')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <AppShell title="Settings" subtitle="Manage your local Raqet data and preferences">
      <PageHeader title="Settings" />

      <div className="max-w-2xl space-y-6">
        {settingsGroups.map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="px-1 font-display text-sm font-bold tracking-label uppercase text-muted">
              {group.title}
            </h2>
            <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card divide-y divide-border">
              {group.items.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-background transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-muted" />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-foreground transition-colors" />
                  </a>
                )
              })}
            </div>
          </section>
        ))}

        <section className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Import Data</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Bring in a Raqet hosted export or a self-hosted JSON export. Records are merged by ID.
              </p>
            </div>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import JSON
            </button>
          </div>
          <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          {importStatus && <p className="mt-4 rounded-lg border border-border bg-background p-3 text-sm text-foreground">{importStatus}</p>}
          {importError && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{importError}</p>}
        </section>

        <section className="rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex items-start gap-3">
            <Brain className="mt-0.5 h-5 w-5 text-muted" />
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">External AI Provider</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                AI is optional. Configure your own external provider with environment variables; Raqet does not require managed Raqet AI infrastructure and never shows API keys in the browser.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3">
              <dt className="text-xs font-medium uppercase tracking-label text-muted">Status</dt>
              <dd className="mt-1 text-foreground">{aiConfig?.configured ? 'Configured' : 'Not configured'}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <dt className="text-xs font-medium uppercase tracking-label text-muted">Provider</dt>
              <dd className="mt-1 text-foreground">{aiConfig?.provider || 'None'}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <dt className="text-xs font-medium uppercase tracking-label text-muted">Model</dt>
              <dd className="mt-1 text-foreground">{aiConfig?.model || 'Not set'}</dd>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <dt className="text-xs font-medium uppercase tracking-label text-muted">Selected clip video AI</dt>
              <dd className="mt-1 text-foreground">{aiConfig?.supportsVideoAnalysis ? 'Available' : 'Unavailable'}</dd>
            </div>
          </dl>
          {!aiConfig?.configured && (
            <p className="mt-4 rounded-lg border border-border bg-background p-3 text-xs leading-5 text-muted">
              Set <code>RAQET_AI_PROVIDER=gemini</code> with <code>GEMINI_API_KEY</code>, or <code>RAQET_AI_PROVIDER=openai</code> with <code>OPENAI_API_KEY</code>. You can also set <code>GEMINI_MODEL</code>, <code>OPENAI_MODEL</code>, or <code>OPENAI_TRANSCRIPTION_MODEL</code>.
            </p>
          )}
        </section>

        <AiActionLogCard />
      </div>
    </AppShell>
  )
}
