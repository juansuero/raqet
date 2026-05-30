import { NextResponse } from 'next/server'
import { listSoloMemories, loadSoloPlayer, saveSoloPlayer, updateSoloMemoryStatus } from '@/lib/solo-store'
import type { MemoryItem } from '@/lib/data'

export async function GET() {
  return NextResponse.json(listSoloMemories())
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json()
  const memory = updateSoloMemoryStatus(id, status as MemoryItem['status'])

  if (memory?.status === 'confirmed' && memory.content) {
    const player = loadSoloPlayer()
    const current = player.profileMarkdown || '# Player Profile\n'
    if (!current.includes(memory.content)) {
      saveSoloPlayer({
        ...player,
        profileMarkdown: `${current.trim()}\n\n## Approved Memory\n- ${memory.content}\n`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
