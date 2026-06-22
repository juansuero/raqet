import type { ReactNode } from 'react'

type TeamStatCardProps = {
  label: string
  value: ReactNode
  detail?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'warning'
}

export function TeamStatCard({ label, value, detail, icon, tone = 'default' }: TeamStatCardProps) {
  const iconTone = tone === 'warning' ? 'text-warning' : 'text-accent'

  return (
    <div className="h-full rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-label text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold leading-none tabular-nums text-foreground">{value}</p>
        </div>
        {icon && <div className={`shrink-0 ${iconTone}`}>{icon}</div>}
      </div>
      {detail && <p className="mt-3 max-w-[54ch] text-pretty text-xs leading-5 text-muted">{detail}</p>}
    </div>
  )
}

export function TeamStatCardSkeleton() {
  return (
    <div className="h-full animate-pulse rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="h-3 w-20 rounded bg-border" />
          <div className="mt-3 h-8 w-16 rounded bg-border" />
        </div>
        <div className="h-5 w-5 shrink-0 rounded bg-border" />
      </div>
      <div className="mt-4 h-4 w-32 rounded bg-border" />
    </div>
  )
}
