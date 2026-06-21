import { NextResponse } from 'next/server'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'
import { generateTrainingBlockDrafts } from '@/lib/openai'
import { listSoloMemories, listSoloPatterns, listSoloSessions, listSoloTournamentMatches, loadSoloPlayer, saveSoloTrainingBlock, soloUser } from '@/lib/solo-store'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    if (!hasConfiguredAiProvider()) return NextResponse.json({ error: 'AI provider is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY, then try again.' }, { status: 503 })

    const profile = loadSoloPlayer()
    const sessions = listSoloSessions().filter((session) => session.status !== 'planned').slice(0, 20)
    const tournamentMatches = listSoloTournamentMatches().slice(0, 12)
    const confirmedMemories = listSoloMemories().filter((memory) => memory.status === 'confirmed').slice(0, 20)
    const approvedPatterns = listSoloPatterns().filter((pattern) => pattern.status === 'approved').slice(0, 20)

    const context = JSON.stringify({
      planMeaning: 'next training block, not a calendar week',
      profile: {
        id: profile.id,
        summary: profile.profileSummary,
        markdown: profile.profileMarkdown,
        currentGoal: profile.currentGoal,
        strengths: profile.strengths,
        weaknesses: profile.weaknesses,
        weeklyTrainingFrequency: profile.weeklyTrainingFrequency,
      },
      confirmedMemories,
      approvedPatterns: approvedPatterns.map((pattern) => ({
        id: pattern.id,
        title: pattern.title,
        description: pattern.description,
        category: pattern.category,
        recommendation: pattern.recommendation,
      })),
      recentSessions: sessions.map((session) => ({
        id: session.id,
        date: session.date,
        type: session.type,
        matchType: session.matchType,
        title: session.title,
        result: session.result,
        score: session.score,
        mainFocus: session.mainFocus,
        rawNotes: session.rawNotes,
        aiSummary: session.aiSummary,
        mainTakeaway: session.mainTakeaway,
        nextFocus: session.nextFocus,
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

    const drafts = await generateTrainingBlockDrafts(context)
    if (drafts.length === 0) return NextResponse.json({ error: 'AI returned no usable training block drafts.' }, { status: 422 })

    const approvedPatternIds = new Set(approvedPatterns.map((pattern) => pattern.id))
    const saved = drafts.slice(0, 8).map((draft) => saveSoloTrainingBlock({
      ...draft,
      id: crypto.randomUUID(),
      playerId: soloUser.id,
      patternId: draft.patternId && approvedPatternIds.has(draft.patternId) ? draft.patternId : undefined,
      status: 'draft',
      source: 'ai',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Training block generation failed.' }, { status: 503 })
  }
}
