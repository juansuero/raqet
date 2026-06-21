import { NextResponse } from 'next/server'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'
import { generatePatternDrafts } from '@/lib/ai'
import { listSoloMemories, listSoloPatterns, listSoloSessions, listSoloTournamentMatches, loadSoloPlayer, saveSoloPattern, soloUser } from '@/lib/solo-store'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    if (!hasConfiguredAiProvider()) return NextResponse.json({ error: 'AI endpoint is not configured. Set RAQET_AI_API_KEY, RAQET_AI_BASE_URL, and RAQET_AI_MODEL, then try again.' }, { status: 503 })

    const profile = loadSoloPlayer()
    const completedSessions = listSoloSessions().filter((session) => session.status !== 'planned').slice(0, 30)
    const matchSessions = completedSessions.filter((session) => session.type === 'match')
    const tournamentMatches = listSoloTournamentMatches().slice(0, 20)
    const confirmedMemories = listSoloMemories().filter((memory) => memory.status === 'confirmed').slice(0, 50)
    const approvedPatterns = listSoloPatterns().filter((pattern) => pattern.status === 'approved').slice(0, 20)
    const ready = completedSessions.length >= 5 || matchSessions.length >= 3 || tournamentMatches.length >= 3 || confirmedMemories.length >= 3

    if (!ready) {
      return NextResponse.json({ error: 'Raqet needs 5 completed sessions, 3 match sessions, 3 tournament matches, or 3 confirmed memories before generating patterns.' }, { status: 400 })
    }

    const context = JSON.stringify({
      rules: {
        pendingOrDiscardedMemoriesAreNotFacts: true,
        evidenceSources: ['completed sessions', 'tournament matches'],
        durableContext: ['player profile', 'confirmed memories', 'approved patterns'],
      },
      profile: {
        id: profile.id,
        summary: profile.profileSummary,
        markdown: profile.profileMarkdown,
        currentGoal: profile.currentGoal,
        strengths: profile.strengths,
        weaknesses: profile.weaknesses,
      },
      confirmedMemories: confirmedMemories.map((memory) => ({ id: memory.id, category: memory.category, content: memory.content })),
      approvedPatterns: approvedPatterns.map((pattern) => ({ id: pattern.id, title: pattern.title, description: pattern.description, category: pattern.category })),
      completedSessions: completedSessions.map((session) => ({
        id: session.id,
        date: session.date,
        type: session.type,
        matchType: session.matchType,
        title: session.title,
        surface: session.surface,
        result: session.result,
        score: session.score,
        mainFocus: session.mainFocus,
        rawNotes: session.rawNotes,
        aiSummary: session.aiSummary,
        mainTakeaway: session.mainTakeaway,
        nextFocus: session.nextFocus,
        tags: session.tags,
      })),
      tournamentMatches: tournamentMatches.map((match) => ({
        id: match.id,
        date: match.date,
        matchType: match.matchType,
        round: match.round,
        opponentName: match.opponentName,
        result: match.result,
        score: match.score,
        notes: match.notes,
      })),
    })

    const drafts = await generatePatternDrafts(context)
    if (drafts.length === 0) return NextResponse.json({ error: 'AI returned no usable pattern drafts.' }, { status: 422 })

    const saved = drafts.slice(0, 6).map((draft) => saveSoloPattern({
      ...draft,
      id: crypto.randomUUID(),
      playerId: soloUser.id,
      relatedClipIds: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pattern generation failed.' }, { status: 503 })
  }
}
