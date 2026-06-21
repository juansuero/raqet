import { NextResponse } from 'next/server'
import { listSoloMemories, loadSoloPlayer, saveSoloPlayer, updateSoloMemoryItem } from '@/lib/solo-store'
import type { MemoryItem } from '@/lib/data'

export async function GET() {
  return NextResponse.json(listSoloMemories())
}

export async function PATCH(request: Request) {
  try {
    const { id, status, content, category } = await request.json()
    if (!id) return NextResponse.json({ error: 'Memory id is required.' }, { status: 400 })

    const existing = listSoloMemories().find((item) => item.id === id)
    if (!existing) return NextResponse.json({ error: 'Memory not found.' }, { status: 404 })

    const memory = updateSoloMemoryItem({ id, status: status as MemoryItem['status'] | undefined, content, category })
    if (!memory) return NextResponse.json({ error: 'Memory update failed.' }, { status: 503 })

    if (memory.status === 'confirmed' && memory.content) {
      const player = loadSoloPlayer()
      const current = player.profileMarkdown || '# Player Profile\n'
      const oldLine = `- ${existing.content}`
      const newLine = `- ${memory.content}`
      const nextMarkdown = current.includes(oldLine)
        ? current.replace(oldLine, newLine)
        : current.includes(memory.content)
          ? current
          : `${current.trim()}\n\n## Approved Memory\n${newLine}\n`

      if (nextMarkdown !== current) {
        saveSoloPlayer({
          ...player,
          profileMarkdown: nextMarkdown,
        })
      }
    }

    return NextResponse.json(memory)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Memory update failed.' }, { status: 503 })
  }
}
