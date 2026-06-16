'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Brain,
  Target,
  Calendar,
  BarChart3,
  UserCircle,
  Settings,
  Menu,
  X,
  MessagesSquare,
  ClipboardList,
  Trophy,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useState } from 'react'
import { useEffect } from 'react'
import { loadPlayer } from '@/lib/api'
import { videoAnalysisEnabled } from '@/lib/features'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/sessions', label: 'Sessions', icon: BookOpen },
  ...(videoAnalysisEnabled ? [{ href: '/clips', label: 'Clips', icon: Video }] : []),
  { href: '/coach', label: 'Coach', icon: MessagesSquare },
  { href: '/opponents', label: 'Opponents', icon: ClipboardList },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/patterns', label: 'Patterns', icon: Target },
  { href: '/training-plan', label: 'Training Plan', icon: Calendar },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/profile', label: 'Profile', icon: UserCircle },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [playerName, setPlayerName] = useState('Player')

  useEffect(() => {
    setCollapsed(window.localStorage.getItem('raqet-nav-collapsed') === 'true')
    loadPlayer().then((player) => {
      if (player?.name) setPlayerName(player.name)
    })
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem('raqet-nav-collapsed', String(!prev))
      return !prev
    })
  }

  const initials = playerName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface shadow-card lg:hidden"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-surface transition-transform duration-200 lg:sticky lg:top-2 lg:h-[calc(100vh-1rem)] lg:translate-x-0 lg:rounded-card lg:border ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-background shadow-card border border-border">
              <Image
                src="/brand/raqet-logo-imagegen.png"
                alt="Raqet"
                width={32}
                height={32}
                className="h-8 w-8 object-cover"
                priority
              />
            </span>
            <div className={collapsed ? 'lg:hidden' : ''}>
              <h1 className="font-display text-lg font-bold tracking-display text-foreground">
                Raqet
              </h1>
              <p className="text-[10px] font-medium tracking-label uppercase text-muted">
                Tennis Log
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mt-4 hidden w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background lg:flex"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span className="ml-2">Collapse</span>}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={item.label}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      collapsed ? 'lg:justify-center' : ''
                    } ${
                      isActive
                        ? 'bg-accent-light text-accent font-semibold'
                        : 'text-muted hover:text-foreground hover:bg-background'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? 'lg:justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div className={`overflow-hidden ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-semibold text-foreground truncate">{playerName}</p>
              <p className="text-xs text-muted truncate">Solo local</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
