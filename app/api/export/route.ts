import { NextResponse } from 'next/server'
import { soloExport } from '@/lib/solo-store'
import { listLocalClips, listLocalVideos } from '@/lib/video-library'

export async function GET() {
  return NextResponse.json({
    ...soloExport(),
    clips: listLocalClips(),
    localVideos: listLocalVideos(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="raqet-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
