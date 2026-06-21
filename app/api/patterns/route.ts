import { NextResponse } from 'next/server'
import type { Pattern } from '@/lib/data'
import { listSoloPatterns, loadSoloPlayer, saveSoloMemory, saveSoloPattern, saveSoloPlayer, soloUser } from '@/lib/solo-store'

function memoryCategoryForPattern(category: string) {
  if (category === 'technical') return 'technical'
  if (category === 'mental') return 'mental'
  if (category === 'physical' || category === 'movement') return 'physical'
  return 'tactical'
}

function patternMemoryContent(pattern: Pattern) {
  return `${pattern.title}: ${pattern.description}`
}

function normalizePattern(input: Partial<Pattern>): Pattern {
  const timestamp = new Date().toISOString()
  return {
    id: input.id || crypto.randomUUID(),
    playerId: soloUser.id,
    memoryId: input.memoryId,
    title: input.title || 'Untitled pattern',
    description: input.description || '',
    category: input.category || 'tactical',
    evidenceCount: Number(input.evidenceCount || 0),
    confidence: input.confidence || 'low',
    trend: input.trend || 'new',
    lastSeen: input.lastSeen || timestamp.slice(0, 10),
    relatedSessionIds: input.relatedSessionIds ?? [],
    relatedTournamentMatchIds: input.relatedTournamentMatchIds ?? [],
    relatedClipIds: input.relatedClipIds ?? [],
    recommendation: input.recommendation || '',
    status: input.status || 'draft',
    evidenceSummary: input.evidenceSummary || '',
    uncertainty: input.uncertainty || '',
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
  }
}

function syncApprovedPatternMemory(existing: Pattern | undefined, pattern: Pattern) {
  if (pattern.status !== 'approved') return pattern

  let next = pattern
  if (!pattern.memoryId) {
    const memory = saveSoloMemory({
      playerId: soloUser.id,
      content: patternMemoryContent(pattern),
      category: memoryCategoryForPattern(pattern.category),
      status: 'confirmed',
    })
    next = saveSoloPattern({ ...pattern, memoryId: memory.id })
  } else {
    saveSoloMemory({
      id: pattern.memoryId,
      playerId: soloUser.id,
      content: patternMemoryContent(pattern),
      category: memoryCategoryForPattern(pattern.category),
      status: 'confirmed',
    })
  }

  const player = loadSoloPlayer()
  const current = player.profileMarkdown || '# Player Profile\n'
  const oldLine = existing ? `- ${patternMemoryContent(existing)}` : ''
  const newLine = `- ${patternMemoryContent(next)}`
  const nextMarkdown = oldLine && current.includes(oldLine)
    ? current.replace(oldLine, newLine)
    : current.includes(patternMemoryContent(next))
      ? current
      : `${current.trim()}\n\n## Approved Memory\n${newLine}\n`

  if (nextMarkdown !== current) {
    saveSoloPlayer({ ...player, profileMarkdown: nextMarkdown })
  }

  return next
}

export async function GET() {
  return NextResponse.json(listSoloPatterns())
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Partial<Pattern>
    if (!body.id) return NextResponse.json({ error: 'Pattern id is required.' }, { status: 400 })

    const existing = listSoloPatterns().find((pattern) => pattern.id === body.id)
    if (!existing) return NextResponse.json({ error: 'Pattern not found.' }, { status: 404 })

    const saved = saveSoloPattern(normalizePattern({ ...existing, ...body, createdAt: existing.createdAt }))
    return NextResponse.json(syncApprovedPatternMemory(existing, saved))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pattern update failed.' }, { status: 503 })
  }
}
