import { NextResponse } from 'next/server'
import { createPlaybackProxy } from '@/lib/video-library'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  try {
    return NextResponse.json(await createPlaybackProxy(id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Playback proxy creation failed.' }, { status: 500 })
  }
}
