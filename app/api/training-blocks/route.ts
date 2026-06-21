import { NextResponse } from 'next/server'
import type { TrainingBlock } from '@/lib/data'
import { listSoloTrainingBlocks, saveSoloTrainingBlock, soloUser } from '@/lib/solo-store'

function normalizeBlock(input: Partial<TrainingBlock>, defaults: Partial<TrainingBlock> = {}): TrainingBlock {
  const timestamp = new Date().toISOString()
  return {
    id: input.id || crypto.randomUUID(),
    playerId: soloUser.id,
    patternId: input.patternId || defaults.patternId,
    title: input.title || defaults.title || 'Untitled training block',
    objective: input.objective || defaults.objective || '',
    category: input.category || defaults.category || 'tactical',
    priority: input.priority || defaults.priority || 'medium',
    durationMinutes: Number(input.durationMinutes || defaults.durationMinutes || 30),
    instructions: input.instructions ?? defaults.instructions ?? [],
    successCriteria: input.successCriteria ?? defaults.successCriteria ?? [],
    evidenceSummary: input.evidenceSummary ?? defaults.evidenceSummary ?? '',
    status: input.status || defaults.status || 'draft',
    source: input.source || defaults.source || 'manual',
    createdAt: input.createdAt || defaults.createdAt || timestamp,
    updatedAt: timestamp,
  }
}

export async function GET() {
  return NextResponse.json(listSoloTrainingBlocks())
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<TrainingBlock>
    const block = normalizeBlock({
      ...body,
      status: 'approved',
      source: 'manual',
    })
    return NextResponse.json(saveSoloTrainingBlock(block), { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Training block save failed.' }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Partial<TrainingBlock>
    if (!body.id) return NextResponse.json({ error: 'Training block id is required.' }, { status: 400 })

    const existing = listSoloTrainingBlocks().find((block) => block.id === body.id)
    if (!existing) return NextResponse.json({ error: 'Training block not found.' }, { status: 404 })

    return NextResponse.json(saveSoloTrainingBlock(normalizeBlock({ ...existing, ...body }, existing)))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Training block update failed.' }, { status: 503 })
  }
}
