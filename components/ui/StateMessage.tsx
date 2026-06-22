import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { FileX } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StateTone = 'default' | 'danger' | 'success'

const toneIconClasses: Record<StateTone, string> = {
  default: 'bg-border text-muted',
  danger: 'bg-danger/10 text-danger',
  success: 'bg-accent-light text-accent',
}

export interface StateMessageProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  tone?: StateTone
  compact?: boolean
  className?: string
}

export function StateMessage({
  title,
  description,
  action,
  icon: Icon = FileX,
  tone = 'default',
  compact = false,
  className,
}: StateMessageProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16', className)}>
      <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-full', toneIconClasses[tone])}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-balance font-display text-lg font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-pretty text-sm leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
