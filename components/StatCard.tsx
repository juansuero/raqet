import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  icon?: React.ReactNode
}

export function StatCard({ title, value, subtitle, trend, trendValue, icon }: StatCardProps) {
  return (
    <div className="h-full bg-surface border border-border rounded-card p-5 shadow-card hover:shadow-hover transition-shadow">
      <div className="mb-3 flex min-h-10 items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 tracking-label uppercase text-muted">{title}</p>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {subtitle && <p className="mt-1 max-w-[54ch] text-pretty text-sm text-muted">{subtitle}</p>}
      {trend && trendValue && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
          trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-muted'
        }`}>
          {trend === 'up' && <TrendingUp className="w-3 h-3" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3" />}
          {trend === 'stable' && <Minus className="w-3 h-3" />}
          {trendValue}
        </div>
      )}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="h-full animate-pulse rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 flex min-h-10 items-start justify-between">
        <div className="h-3 w-20 rounded bg-border" />
        <div className="h-4 w-4 rounded bg-border" />
      </div>
      <div className="h-8 w-16 rounded bg-border" />
      <div className="mt-3 h-4 w-24 rounded bg-border" />
    </div>
  )
}
