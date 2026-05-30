import type { Session } from '@/lib/data'
import type { PreSessionFocus } from '@/lib/openai'

export function formatPreSessionFocus(focus: PreSessionFocus) {
  return [
    focus.focus,
    focus.tacticalCues.length ? `Cues: ${focus.tacticalCues.join(' / ')}` : '',
    focus.avoid ? `Avoid: ${focus.avoid}` : '',
    focus.warmupIntention ? `Warm-up: ${focus.warmupIntention}` : '',
    focus.matchupNote ? `Matchup: ${focus.matchupNote}` : '',
  ].filter(Boolean).join('\n')
}

export function scheduledSessionContext(session: Session) {
  return [
    `Title: ${session.title}`,
    `Type: ${session.type}`,
    `Status: ${session.status ?? 'completed'}`,
    `Start: ${session.scheduledStartAt || session.date}`,
    `Duration: ${session.durationMinutes} minutes`,
    `Surface: ${session.surface || 'not set'}`,
    `Location: ${session.location || 'not set'}`,
    `Match format: ${session.type === 'match' ? session.matchType ?? 'singles' : 'not a match'}`,
    `Opponent: ${session.opponentName || 'not provided'}`,
    `Partner: ${session.partnerName || 'not provided'}`,
    `Opponent partner: ${session.opponentPartnerName || 'not provided'}`,
    `Planned focus: ${session.mainFocus || 'not provided'}`,
    `Notes: ${session.rawNotes || 'not provided'}`,
  ].join('\n')
}
