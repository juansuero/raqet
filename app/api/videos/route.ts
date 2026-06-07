import { NextResponse } from 'next/server'
import { importLocalVideo, listLocalVideos, videoStorageInfo } from '@/lib/video-library'

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get('projectId') || undefined
  const videos = listLocalVideos()
  const filtered = projectId ? videos.filter((v) => v.projectId === projectId) : videos
  return NextResponse.json({ videos: filtered, storage: videoStorageInfo(projectId) })
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file')
  const sessionId = typeof form.get('sessionId') === 'string' ? String(form.get('sessionId')) : ''
  const projectId = typeof form.get('projectId') === 'string' ? String(form.get('projectId')) : undefined
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an MP4, MOV, MPEG, MPG, or WebM file.' }, { status: 400 })

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['mp4', 'mov', 'mpeg', 'mpg', 'webm'].includes(extension)) {
    return NextResponse.json({ error: 'Choose an MP4, MOV, MPEG, MPG, or WebM file.' }, { status: 400 })
  }

  return NextResponse.json(await importLocalVideo(file, sessionId, projectId), { status: 201 })
}
