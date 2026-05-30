import { NextResponse } from 'next/server'
import { importLocalVideo, listLocalVideos, videoStorageInfo } from '@/lib/video-library'

export async function GET() {
  return NextResponse.json({ videos: listLocalVideos(), storage: videoStorageInfo() })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file')
  const sessionId = typeof form.get('sessionId') === 'string' ? String(form.get('sessionId')) : ''
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an MP4, MOV, MPEG, MPG, or WebM file.' }, { status: 400 })

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['mp4', 'mov', 'mpeg', 'mpg', 'webm'].includes(extension)) {
    return NextResponse.json({ error: 'Choose an MP4, MOV, MPEG, MPG, or WebM file.' }, { status: 400 })
  }

  return NextResponse.json(await importLocalVideo(file, sessionId), { status: 201 })
}
