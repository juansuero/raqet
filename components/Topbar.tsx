'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import type { InAppNotification } from '@/lib/data'

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [open, setOpen] = useState(false)

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length, [notifications])

  const loadNotifications = async () => {
    await fetch('/api/notifications/generate-due', { method: 'POST' }).catch(() => null)
    const response = await fetch('/api/notifications').catch(() => null)
    if (!response?.ok) return
    setNotifications(await response.json())
  }

  useEffect(() => {
    loadNotifications()
    const interval = window.setInterval(loadNotifications, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const markRead = async (id?: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
    }).catch(() => null)
    setNotifications((prev) => prev.map((item) => !id || item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
  }

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="lg:ml-0 ml-12">
          <h1 className="font-display text-2xl font-bold tracking-display text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 max-w-[54ch] text-sm text-muted">{subtitle}</p>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-foreground"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-card border border-border bg-surface shadow-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="font-display text-sm font-bold text-foreground">Notifications</p>
                {unreadCount > 0 && (
                  <button type="button" onClick={() => markRead()} className="text-xs font-medium text-accent">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted">No notifications yet.</p>
                ) : (
                  notifications.map((notification) => (
                    <div key={notification.id} className={`border-b border-border px-4 py-3 last:border-b-0 ${notification.readAt ? '' : 'bg-accent-light/40'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                          <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-5 text-muted">{notification.body}</pre>
                          {notification.sessionId && (
                            <Link href={`/sessions/new?edit=${notification.sessionId}`} className="mt-2 inline-flex text-xs font-medium text-accent" onClick={() => markRead(notification.id)}>
                              Open session
                            </Link>
                          )}
                        </div>
                        {!notification.readAt && (
                          <button type="button" onClick={() => markRead(notification.id)} className="shrink-0 text-xs font-medium text-muted hover:text-foreground">
                            Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
