import { Readable } from 'stream'
import { NextResponse } from 'next/server'
import { getLocalVideo, readVideoRange } from '@/lib/video-library'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const video = getLocalVideo(id)
  if (!video) return NextResponse.json({ error: 'Video not found.' }, { status: 404 })

  const range = readVideoRange(video, request.headers.get('range'))
  const headers = new Headers({
    'Content-Type': video.mimeType || 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(range.contentLength),
  })

  if (request.headers.get('range')) {
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${range.size}`)
    return new Response(Readable.toWeb(range.stream) as ReadableStream, { status: 206, headers })
  }

  return new Response(Readable.toWeb(range.stream) as ReadableStream, { headers })
}
