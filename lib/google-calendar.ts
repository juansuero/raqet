import type { Session } from '@/lib/data'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

type CalendarConnectionRow = {
  id: string
  user_id: string
  google_account_email?: string | null
  calendar_id: string
  access_token: string
  refresh_token?: string | null
  token_expires_at?: string | null
  scope?: string | null
}

function googleClientId() {
  const value = process.env.GOOGLE_CLIENT_ID
  if (!value) throw new Error('Missing GOOGLE_CLIENT_ID')
  return value
}

function googleClientSecret() {
  const value = process.env.GOOGLE_CLIENT_SECRET
  if (!value) throw new Error('Missing GOOGLE_CLIENT_SECRET')
  return value
}

export function appBaseUrl(request?: Request) {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (request ? new URL(request.url).origin : '')
}

export function googleCalendarRedirectUri(request?: Request) {
  return `${appBaseUrl(request)}/api/integrations/google-calendar/callback`
}

export function googleCalendarAuthUrl(state: string, request?: Request) {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: googleCalendarRedirectUri(request),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeGoogleCalendarCode(code: string, request?: Request) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: googleCalendarRedirectUri(request),
      grant_type: 'authorization_code',
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Google Calendar authorization failed')
  return data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }
}

export async function refreshGoogleCalendarToken(connection: CalendarConnectionRow) {
  if (!connection.refresh_token) return connection

  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
  if (expiresAt && expiresAt - Date.now() > 2 * 60 * 1000) return connection

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: connection.refresh_token,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error_description || data?.error || 'Google Calendar token refresh failed')

  return {
    ...connection,
    access_token: data.access_token,
    token_expires_at: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : connection.token_expires_at,
    scope: data.scope || connection.scope,
  }
}

function eventPayload(session: Session) {
  if (!session.scheduledStartAt || !session.scheduledEndAt) throw new Error('Scheduled sessions need start and end times')

  return {
    summary: `Raqet: ${session.title}`,
    location: session.location || undefined,
    description: [
      session.preSessionFocus ? `Focus:\n${session.preSessionFocus}` : '',
      session.mainFocus ? `Planned focus: ${session.mainFocus}` : '',
      session.rawNotes ? `Notes:\n${session.rawNotes}` : '',
    ].filter(Boolean).join('\n\n'),
    start: { dateTime: session.scheduledStartAt },
    end: { dateTime: session.scheduledEndAt },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: session.reminderMinutes ?? 60 },
      ],
    },
  }
}

export async function upsertGoogleCalendarEvent(connection: CalendarConnectionRow, session: Session) {
  const calendarId = connection.calendar_id || 'primary'
  const eventId = session.calendarEventId
  const url = eventId
    ? `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    : `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`

  const response = await fetch(url, {
    method: eventId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload(session)),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error?.message || 'Google Calendar event sync failed')
  return data as { id: string; htmlLink?: string }
}

export async function deleteGoogleCalendarEvent(connection: CalendarConnectionRow, calendarEventId: string) {
  const calendarId = connection.calendar_id || 'primary'
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(calendarEventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${connection.access_token}` },
  })
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message || 'Google Calendar event delete failed')
  }
}
