import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '@/lib/utils'

export type SurfaceVariant = 'panel' | 'card' | 'table' | 'modal' | 'formSection'

export const surfaceVariantClasses: Record<SurfaceVariant, string> = {
  panel: 'rounded-card border border-border bg-surface shadow-card',
  card: 'rounded-card border border-border bg-surface',
  table: 'overflow-hidden rounded-card border border-border bg-surface',
  modal: 'rounded-modal border border-border bg-surface shadow-card',
  formSection: 'rounded-card border border-border bg-surface',
}

type SurfaceOwnProps<T extends ElementType> = {
  as?: T
  variant?: SurfaceVariant
  className?: string
}

export type SurfaceProps<T extends ElementType = 'div'> = SurfaceOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof SurfaceOwnProps<T>>

export function Surface<T extends ElementType = 'div'>({
  as,
  variant = 'panel',
  className,
  ...props
}: SurfaceProps<T>) {
  const Component = (as ?? 'div') as ElementType
  return <Component className={cn(surfaceVariantClasses[variant], className)} {...props} />
}
