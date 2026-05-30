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
    <div className="bg-surface border border-border rounded-card p-5 shadow-card hover:shadow-hover transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium tracking-label uppercase text-muted">{title}</p>
        {icon && <div className="text-muted">{icon}</div>}
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {subtitle && <p className="mt-1 max-w-[54ch] text-sm text-muted">{subtitle}</p>}
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
