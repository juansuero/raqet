import { NextResponse } from 'next/server'
import { importLocalVideoPath, LocalVideoImportError } from '@/lib/video-library'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { filePath?: unknown; sessionId?: unknown; projectId?: unknown }
  const filePath = typeof body.filePath === 'string' ? body.filePath.trim() : ''
  if (!filePath) return NextResponse.json({ error: 'Local file path is required.' }, { status: 400 })

  try {
    const video = await importLocalVideoPath({
      filePath,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
    })
    return NextResponse.json(video, { status: 201 })
  } catch (error) {
    if (error instanceof LocalVideoImportError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }

    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOSPC') {
      return NextResponse.json({ error: 'Not enough free disk space to copy this video.', code: 'DISK_FULL' }, { status: 507 })
    }
    if (nodeError?.code === 'EACCES' || nodeError?.code === 'EPERM') {
      return NextResponse.json({ error: 'Raqet cannot read that file path. Check file permissions or move the video to a normal local folder.', code: nodeError.code }, { status: 403 })
    }

    console.error('Local video import failed', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Local video import failed.' }, { status: 500 })
  }
}
