import { NextResponse } from 'next/server'
import { exportStandardClip } from '@/lib/video-library'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return NextResponse.json(await exportStandardClip(id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Clip export failed.' }, { status: 503 })
  }
}
