import { NextResponse } from 'next/server'
import { getLocalVideo, localVideoFileAvailable, nodeStreamToWebStream, playbackMimeType, readVideoRange } from '@/lib/video-library'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const video = getLocalVideo(id)
  if (!video) return NextResponse.json({ error: 'Video not found.' }, { status: 404 })
  if (!localVideoFileAvailable(video)) return NextResponse.json({ error: 'Source video file is missing from local storage.' }, { status: 404 })

  let range: ReturnType<typeof readVideoRange>
  try {
    range = readVideoRange(video, request.headers.get('range'))
  } catch {
    return NextResponse.json({ error: 'Source video file is missing from local storage.' }, { status: 404 })
  }
  const headers = new Headers({
    'Content-Type': playbackMimeType(video),
    'Accept-Ranges': 'bytes',
    'Content-Length': String(range.contentLength),
  })

  if (request.headers.get('range')) {
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${range.size}`)
    return new Response(nodeStreamToWebStream(range.stream), { status: 206, headers })
  }

  return new Response(nodeStreamToWebStream(range.stream), { headers })
}
