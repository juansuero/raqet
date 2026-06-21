import { existsSync, readFileSync } from 'node:fs'
import { NextResponse } from 'next/server'
import { analyzeClipBuffer } from '@/lib/ai'
import { getLocalClip, saveLocalClip } from '@/lib/video-library'
import { listSoloMemories, loadSoloPlayer, saveSoloMemory } from '@/lib/solo-store'

export const runtime = 'nodejs'
export const maxDuration = 60

const CLIP_ANALYSIS_PROMPT_VERSION = 'clip-analysis-v1'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const clip = getLocalClip(id)
    if (!clip) return NextResponse.json({ error: 'Clip not found.' }, { status: 404 })
    if (!clip.exportedClipPath) {
      return NextResponse.json({ error: 'Export a short clip first. Raqet never sends the source full-match video for AI analysis.' }, { status: 400 })
    }
    if (!existsSync(clip.exportedClipPath)) {
      return NextResponse.json({ error: 'The exported clip file is missing. Re-export the clip before AI analysis.' }, { status: 404 })
    }

    const player = loadSoloPlayer()
    const memoryContext = [
      player.profileMarkdown ? `Player Profile:\n${player.profileMarkdown}` : '',
      !player.profileMarkdown && player.profileSummary ? `Profile summary: ${player.profileSummary}` : '',
      listSoloMemories().filter((memory) => memory.status === 'confirmed').slice(0, 12).map((memory) => `- [${memory.category}] ${memory.content}`).join('\n'),
    ].filter(Boolean).join('\n\n').slice(0, 8000)

    const clipContext = [
      `Prompt version: ${CLIP_ANALYSIS_PROMPT_VERSION}`,
      `Title: ${clip.title}`,
      `Point result: ${clip.pointResult}`,
      clip.pointEnding ? `Point ending: ${clip.pointEnding}` : '',
      clip.shotContext ? `Shot context: ${clip.shotContext}` : '',
      clip.scoreContext ? `Score/context: ${clip.scoreContext}` : '',
      clip.playerIntention ? `Notes: ${clip.playerIntention}` : '',
      clip.tags.length ? `Tags: ${clip.tags.join(', ')}` : '',
      `Clip duration seconds: ${clip.durationSeconds}`,
    ].filter(Boolean).join('\n')

    const analysis = await analyzeClipBuffer(readFileSync(clip.exportedClipPath), 'video/mp4', clipContext, memoryContext)
    const saved = saveLocalClip({
      ...clip,
      ...analysis,
      aiPromptVersion: CLIP_ANALYSIS_PROMPT_VERSION,
      tags: Array.from(new Set([...(clip.tags ?? []), ...analysis.tags])),
    })

    if (analysis.profileMemoryUpdate) {
      saveSoloMemory({
        playerId: player.id,
        content: analysis.profileMemoryUpdate,
        category: 'technical',
        status: 'pending',
      })
    }

    return NextResponse.json(saved)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Selected clip analysis failed.' }, { status: 503 })
  }
}
