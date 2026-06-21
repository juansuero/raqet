import { NextResponse } from 'next/server'
import type { SessionTrainingBlockLink } from '@/lib/data'
import { getSoloSession, listSoloSessionTrainingBlocks, listSoloTrainingBlocks, replaceSoloSessionTrainingBlocks } from '@/lib/solo-store'

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('sessionId')
  const links = listSoloSessionTrainingBlocks()
  return NextResponse.json(sessionId ? links.filter((link) => link.sessionId === sessionId) : links)
}

export async function PUT(request: Request) {
  try {
    const { sessionId, links } = await request.json() as {
      sessionId?: string
      links?: Array<Pick<SessionTrainingBlockLink, 'trainingBlockId' | 'completionStatus' | 'successCriteriaNotes'>>
    }

    if (!sessionId || !Array.isArray(links)) {
      return NextResponse.json({ error: 'Session id and links are required.' }, { status: 400 })
    }

    if (!getSoloSession(sessionId)) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    const approvedBlocks = new Set(listSoloTrainingBlocks().filter((block) => block.status === 'approved').map((block) => block.id))
    const blockIds = links.map((link) => link.trainingBlockId).filter(Boolean)
    if (blockIds.some((id) => !approvedBlocks.has(id))) {
      return NextResponse.json({ error: 'Only approved active blocks can be attached.' }, { status: 400 })
    }

    return NextResponse.json(replaceSoloSessionTrainingBlocks(sessionId, links))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Session training block save failed.' }, { status: 503 })
  }
}
