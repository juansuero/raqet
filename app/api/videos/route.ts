import { NextResponse } from 'next/server'
import Busboy from 'busboy'
import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'
import { deleteLocalVideo, importLocalVideoStream, listAvailableLocalVideos, videoStorageInfo } from '@/lib/video-library'

export const runtime = 'nodejs'

const allowedVideoExtensions = new Set(['mp4', 'mov', 'mpeg', 'mpg', 'webm'])

function validVideoFileName(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return Boolean(extension && allowedVideoExtensions.has(extension))
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get('projectId') || undefined
  const videos = listAvailableLocalVideos()
  const filtered = projectId ? videos.filter((v) => v.projectId === projectId) : videos
  return NextResponse.json({ videos: filtered, storage: videoStorageInfo(projectId) })
}

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Upload the video as multipart form data.' }, { status: 400 })
  }

  if (!request.body) {
    return NextResponse.json({ error: 'Missing video upload body.' }, { status: 400 })
  }

  const url = new URL(request.url)
  const fields = {
    sessionId: url.searchParams.get('sessionId') || '',
    projectId: url.searchParams.get('projectId') || '',
  }
  let importPromise: ReturnType<typeof importLocalVideoStream> | null = null
  let uploadErrorMessage = ''

  const busboy = Busboy({
    headers: { 'content-type': contentType },
    limits: { files: 1 },
  })

  busboy.on('field', (name, value) => {
    if (name === 'sessionId') fields.sessionId = value
    if (name === 'projectId') fields.projectId = value
  })

  busboy.on('file', (name, stream, info) => {
    if (name !== 'file') {
      stream.resume()
      return
    }

    if (!validVideoFileName(info.filename)) {
      uploadErrorMessage = 'Choose an MP4, MOV, MPEG, MPG, or WebM file.'
      stream.resume()
      return
    }

    importPromise = importLocalVideoStream({
      stream,
      fileName: info.filename,
      mimeType: info.mimeType || 'application/octet-stream',
      sessionId: fields.sessionId,
      projectId: fields.projectId || undefined,
    })
  })

  busboy.on('filesLimit', () => {
    uploadErrorMessage = 'Upload one video at a time.'
  })

  try {
    await new Promise<void>((resolve, reject) => {
      busboy.on('error', reject)
      busboy.on('finish', resolve)
      Readable.fromWeb(request.body as unknown as NodeReadableStream<Uint8Array>).pipe(busboy)
    })

    if (uploadErrorMessage) return NextResponse.json({ error: uploadErrorMessage }, { status: 400 })
    if (!importPromise) {
      return NextResponse.json({ error: 'Choose an MP4, MOV, MPEG, MPG, or WebM file.' }, { status: 400 })
    }

    return NextResponse.json(await importPromise, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Video import failed.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Video id is required.' }, { status: 400 })
  const deleted = deleteLocalVideo(id)
  if (!deleted) return NextResponse.json({ error: 'Video not found.' }, { status: 404 })
  return NextResponse.json({ deletedId: id })
}
