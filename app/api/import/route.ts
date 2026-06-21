import { NextResponse } from 'next/server'
import type { Clip, CoachMessage, MemoryItem, Opponent, Player, Project, RatingHistoryEntry, Session, Tournament, TournamentMatch } from '@/lib/data'
import {
  saveSoloCoachMessage,
  saveSoloMemory,
  saveSoloOpponent,
  saveSoloPattern,
  saveSoloPlayer,
  saveSoloProject,
  saveSoloRating,
  saveSoloSession,
  saveSoloSessionTrainingBlock,
  saveSoloTournament,
  saveSoloTournamentMatch,
  saveSoloTrainingBlock,
  soloUser,
} from '@/lib/solo-store'
import { saveLocalClip } from '@/lib/video-library'

type ImportRecord = Record<string, any> & { id?: string }

function arrayOfRecords(value: unknown): ImportRecord[] {
  return Array.isArray(value) ? value.filter((item): item is ImportRecord => typeof item === 'object' && item !== null) : []
}

function count(name: string, value: number) {
  return { name, value }
}

function withSoloPlayer<T extends ImportRecord>(item: T) {
  return { ...item, playerId: soloUser.id }
}

function normalizeProfile(profile: ImportRecord | null): Player | null {
  if (!profile) return null
  return {
    ...profile,
    id: soloUser.id,
    userId: soloUser.id,
    email: soloUser.email,
    name: typeof profile.name === 'string' && profile.name.trim() ? profile.name : soloUser.user_metadata.full_name,
  } as Player
}

function normalizeSession(item: ImportRecord): Session {
  return {
    ...withSoloPlayer(item),
    organizationId: undefined,
    teamId: undefined,
    seasonId: undefined,
    visibility: 'private',
    calendarId: undefined,
    calendarEventId: undefined,
    calendarHtmlLink: undefined,
  } as Session
}

function normalizeClip(item: ImportRecord): Clip {
  const durationSeconds = Number(item.durationSeconds ?? 0)
  const startMs = Number(item.startMs ?? 0)
  const endMs = Number(item.endMs ?? Math.max(0, Math.round(durationSeconds * 1000)))
  return {
    ...withSoloPlayer(item),
    id: item.id || crypto.randomUUID(),
    sessionId: item.sessionId || '',
    localVideoId: item.localVideoId || undefined,
    startMs,
    endMs,
    title: item.title || 'Imported clip',
    videoUrl: item.videoUrl || '',
    thumbnailUrl: item.thumbnailUrl || '',
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : Math.max(0, Math.round((endMs - startMs) / 1000)),
    clipType: item.clipType || 'rally',
    pointResult: item.pointResult || 'unknown',
    pointEnding: item.pointEnding || 'other',
    shotContext: item.shotContext || 'rally',
    decisionQuality: Number(item.decisionQuality ?? 0),
    contentScore: Number(item.contentScore ?? 0),
    suggestedUse: item.suggestedUse || 'analysis',
    tags: Array.isArray(item.tags) ? item.tags : [],
    reelKeyframes: Array.isArray(item.reelKeyframes) ? item.reelKeyframes : [],
    events: Array.isArray(item.events) ? item.events : [],
    createdAt: item.createdAt || new Date().toISOString(),
  } as Clip
}

function normalizeGeneric(item: ImportRecord) {
  return {
    ...withSoloPlayer(item),
    id: item.id || crypto.randomUUID(),
    createdAt: item.createdAt || new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Import file must be valid Raqet JSON.' }, { status: 400 })
    }

    const profile = normalizeProfile('profile' in body ? (body as { profile?: ImportRecord }).profile ?? null : null)
    if (profile) saveSoloPlayer(profile)

    const sessions = arrayOfRecords((body as { sessions?: unknown }).sessions)
    sessions.forEach((item) => saveSoloSession(normalizeSession(item)))

    const opponents = arrayOfRecords((body as { opponents?: unknown }).opponents)
    opponents.forEach((item) => saveSoloOpponent(withSoloPlayer({ ...item, id: item.id || crypto.randomUUID() }) as Opponent))

    const tournaments = arrayOfRecords((body as { tournaments?: unknown }).tournaments)
    tournaments.forEach((item) => saveSoloTournament(withSoloPlayer({ ...item, id: item.id || crypto.randomUUID() }) as Tournament))

    const tournamentMatches = arrayOfRecords((body as { tournamentMatches?: unknown }).tournamentMatches)
    tournamentMatches.forEach((item) => saveSoloTournamentMatch(withSoloPlayer({ ...item, id: item.id || crypto.randomUUID() }) as TournamentMatch))

    const memories = arrayOfRecords((body as { memories?: unknown }).memories)
    memories.forEach((item) => saveSoloMemory(withSoloPlayer({ ...item, id: item.id || crypto.randomUUID() }) as MemoryItem))

    const coachMessages = arrayOfRecords((body as { coachMessages?: unknown }).coachMessages)
    coachMessages.forEach((item) => saveSoloCoachMessage({ ...item, id: item.id || crypto.randomUUID() } as CoachMessage))

    const ratingHistory = arrayOfRecords((body as { ratingHistory?: unknown }).ratingHistory)
    ratingHistory.forEach((item) => saveSoloRating(withSoloPlayer({ ...item, id: item.id || crypto.randomUUID() }) as RatingHistoryEntry))

    const projects = arrayOfRecords((body as { projects?: unknown }).projects)
    projects.forEach((item) => saveSoloProject({ ...item, id: item.id || crypto.randomUUID(), name: item.name || 'Imported project', createdAt: item.createdAt || new Date().toISOString() } as Project))

    const clips = arrayOfRecords((body as { clips?: unknown }).clips)
    clips.forEach((item) => saveLocalClip(normalizeClip(item)))

    const patterns = arrayOfRecords((body as { patterns?: unknown }).patterns)
    patterns.forEach((item) => saveSoloPattern(normalizeGeneric(item)))

    const trainingBlocks = arrayOfRecords((body as { trainingBlocks?: unknown }).trainingBlocks)
    trainingBlocks.forEach((item) => saveSoloTrainingBlock(normalizeGeneric(item)))

    const sessionTrainingBlocks = arrayOfRecords((body as { sessionTrainingBlocks?: unknown }).sessionTrainingBlocks)
    sessionTrainingBlocks.forEach((item) => saveSoloSessionTrainingBlock(normalizeGeneric(item)))

    return NextResponse.json({
      ok: true,
      importedAt: new Date().toISOString(),
      counts: [
        count('profile', profile ? 1 : 0),
        count('sessions', sessions.length),
        count('opponents', opponents.length),
        count('tournaments', tournaments.length),
        count('tournamentMatches', tournamentMatches.length),
        count('memories', memories.length),
        count('coachMessages', coachMessages.length),
        count('ratingHistory', ratingHistory.length),
        count('projects', projects.length),
        count('clips', clips.length),
        count('patterns', patterns.length),
        count('trainingBlocks', trainingBlocks.length),
        count('sessionTrainingBlocks', sessionTrainingBlocks.length),
      ],
      skipped: {
        usageEvents: arrayOfRecords((body as { usageEvents?: unknown }).usageEvents).length,
        aiActionLogs: arrayOfRecords((body as { aiActionLogs?: unknown }).aiActionLogs).length,
        localVideos: arrayOfRecords((body as { localVideos?: unknown }).localVideos).length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 })
  }
}
