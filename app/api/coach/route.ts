import { NextResponse } from 'next/server'
import { generateCoachReply } from '@/lib/ai'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'
import { deleteSoloCoachPair, listSoloCoachMessages, listSoloMemories, listSoloRatingHistory, listSoloSessions, listSoloTournamentMatches, loadSoloPlayer, saveSoloCoachMessage } from '@/lib/solo-store'

function compactList<T>(items: T[] | null, mapper: (item: T) => string) {
  return (items ?? []).map(mapper).filter(Boolean).join('\n')
}

function transientReply(message: string, reply: string) {
  const userMessage = saveSoloCoachMessage({ role: 'user', content: message })
  const assistantMessage = saveSoloCoachMessage({ role: 'assistant', content: reply })
  return { userMessage, assistantMessage }
}

function isClearlyOutOfScope(message: string) {
  const normalized = message.toLowerCase()
  const tennisOrAppTerms = ['tennis', 'serve', 'return', 'rally', 'forehand', 'backhand', 'volley', 'match', 'session', 'tournament', 'opponent', 'utr', 'wtn', 'ranking', 'court', 'surface', 'fitness', 'training', 'practice', 'raqet', 'journal', 'profile', 'memory']
  const obviousOffTopicTerms = ['recipe', 'cookies', 'cake', 'pizza', 'code', 'programming', 'stock', 'crypto', 'mortgage', 'movie', 'homework', 'essay']

  return obviousOffTopicTerms.some((term) => normalized.includes(term)) &&
    !tennisOrAppTerms.some((term) => normalized.includes(term))
}

export async function GET() {
  return NextResponse.json(listSoloCoachMessages())
}

export async function POST(request: Request) {
  const body = await request.json()
  const message = String(body.message || '').trim()
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 })

  const player = loadSoloPlayer()
  const firstName = player.name.split(' ')[0]
  if (isClearlyOutOfScope(message)) {
    return NextResponse.json(transientReply(message, `I can only help with your tennis, training, recovery, tournaments, rankings, or Raqet journal context${firstName ? `, ${firstName}` : ''}. Ask me about your next match plan, what to focus on this week, or a pattern from your recent sessions.`))
  }

  if (!hasConfiguredAiProvider()) {
    return NextResponse.json(transientReply(message, 'Local coach chat is ready, but no AI endpoint is configured. Add RAQET_AI_API_KEY, RAQET_AI_BASE_URL, and RAQET_AI_MODEL to enable generated coaching replies.'))
  }

  const recentSessions = listSoloSessions().slice(0, 12)
  const recentTournamentMatches = listSoloTournamentMatches().slice(0, 12)
  const matchSessions = recentSessions.filter((session) => session.type === 'match')
  const doublesItems = [
    ...matchSessions.filter((session) => session.matchType === 'doubles'),
    ...recentTournamentMatches.filter((match) => match.matchType === 'doubles'),
  ]
  const singlesItems = [
    ...matchSessions.filter((session) => session.matchType !== 'doubles'),
    ...recentTournamentMatches.filter((match) => match.matchType !== 'doubles'),
  ]
  const context = [
    [
      'Evidence ledger:',
      `- Recent sessions supplied: ${recentSessions.length}`,
      `- Recent match sessions supplied: ${matchSessions.length}`,
      `- Recent tournament matches supplied: ${recentTournamentMatches.length}`,
      `- Singles evidence items supplied: ${singlesItems.length}`,
      `- Doubles evidence items supplied: ${doublesItems.length}`,
      '- Calibrate confidence from these counts. Do not infer a stable pattern from one item.',
    ].join('\n'),
    [
      `Name: ${player.name}`,
      `Profile summary: ${player.profileSummary || 'not set'}`,
      `Goal: ${player.currentGoal || 'not set'}`,
      `Style: ${player.playingStyle || 'not set'}`,
      `Strengths: ${player.strengths.join(', ') || 'not set'}`,
      `Weaknesses: ${player.weaknesses.join(', ') || 'not set'}`,
      player.profileMarkdown ? `Durable Player Profile:\n${player.profileMarkdown}` : '',
    ].filter(Boolean).join('\n'),
    compactList(listSoloMemories().filter((memory) => memory.status === 'confirmed').slice(0, 16), (memory) => `Memory: [${memory.category}] ${memory.content}`),
    compactList(recentSessions, (session) => `Session: ${session.date} ${session.type}/${session.matchType ?? 'n/a'} "${session.title}" ${session.result || ''} surface=${session.surface || 'n/a'} focus=${session.mainFocus || 'n/a'} takeaway=${session.mainTakeaway || session.aiSummary || 'n/a'} next=${session.nextFocus || 'n/a'}`),
    compactList(listSoloRatingHistory().slice(-12), (rating) => `Ranking: ${rating.eventDate} ${rating.label}=${rating.value} ${rating.lowerIsBetter ? '(lower is better)' : '(higher is better)'}`),
    compactList(recentTournamentMatches, (match) => `Tournament match: ${match.date} ${match.matchType ?? 'singles'} ${match.round} vs ${match.opponentName || 'opponent'} result=${match.result} score=${match.score || 'n/a'} notes=${match.notes || 'n/a'}`),
  ].filter(Boolean).join('\n\n').slice(0, 16000)

  const reply = await generateCoachReply(message, context)
  return NextResponse.json(transientReply(message, reply))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('messageId')
  if (!messageId) return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  return NextResponse.json({ deletedIds: deleteSoloCoachPair(messageId) })
}
