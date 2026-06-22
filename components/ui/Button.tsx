import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'
type IconButtonSize = 'sm' | 'md' | 'lg'

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium outline-none transition-[transform,background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/90',
  secondary: 'border border-border bg-surface text-foreground hover:bg-background',
  ghost: 'text-accent hover:bg-accent-light',
  danger: 'border border-danger/30 text-danger hover:bg-danger/10',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 py-2 text-xs',
  md: 'min-h-11 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base',
}

const iconSizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
}

type PressProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  press?: boolean
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & PressProps

export function Button({ variant = 'primary', size = 'md', press = true, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], press && 'active:scale-[0.96]', className)}
      {...props}
    />
  )
}

export type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & PressProps

export function ButtonLink({ variant = 'primary', size = 'md', press = true, className, ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], press && 'active:scale-[0.96]', className)}
      {...props}
    />
  )
}

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: IconButtonSize
  press?: boolean
}

export function IconButton({ variant = 'secondary', size = 'md', press = true, className, ...props }: IconButtonProps) {
  return (
    <button
      className={cn(baseClasses, variantClasses[variant], iconSizeClasses[size], press && 'active:scale-[0.96]', className)}
      {...props}
    />
  )
}
