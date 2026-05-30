import { NextResponse } from 'next/server'
import { exportReelClip } from '@/lib/video-library'
import type { ReelKeyframe } from '@/lib/data'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    return NextResponse.json(await exportReelClip(id, (body.keyframes || []) as ReelKeyframe[]))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Reel export failed.' }, { status: 503 })
  }
}
