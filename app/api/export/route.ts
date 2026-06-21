import { NextResponse } from 'next/server'
import { soloExport } from '@/lib/solo-store'
import { listLocalClips, listLocalVideos } from '@/lib/video-library'

export async function GET() {
  return NextResponse.json({
    ...soloExport(),
    clips: listLocalClips(),
    localVideos: listLocalVideos(),
  })
}
