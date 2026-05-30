'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { AiActionLogCard } from '@/components/AiActionLog'
import { UserCircle, FileText, Shield, Download, ChevronRight, Brain } from 'lucide-react'

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

export default function SettingsPage() {
  const [aiConfig, setAiConfig] = useState<{
    configured: boolean
    provider: string | null
    model: string | null
    missingEnv: string[]
    supportsVideoAnalysis: boolean
  } | null>(null)

  useEffect(() => {
    fetch('/api/ai/config').then((response) => response.json()).then(setAiConfig).catch(() => null)
  }, [])

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
