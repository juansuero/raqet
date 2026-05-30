import { createReadStream, existsSync, statSync } from 'fs'
import { Readable } from 'stream'
import { NextResponse } from 'next/server'
import { getLocalClip } from '@/lib/video-library'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clip = getLocalClip(id)
  const filePath = new URL(request.url).searchParams.get('kind') === 'reel' ? clip?.exportedReelPath : clip?.exportedClipPath
  if (!filePath || !existsSync(filePath)) return NextResponse.json({ error: 'Exported media not found.' }, { status: 404 })

  const size = statSync(filePath).size
  const rangeHeader = request.headers.get('range')
  const match = rangeHeader?.match(/bytes=(\d+)-(\d*)/)
  const start = match ? Number(match[1]) : 0
  const end = match && match[2] ? Number(match[2]) : size - 1
  const stream = createReadStream(filePath, { start, end })
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
  })

  if (rangeHeader) {
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers })
  }

  return new Response(Readable.toWeb(stream) as ReadableStream, { headers })
}
