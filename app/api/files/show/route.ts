import { existsSync, statSync } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { NextResponse } from 'next/server'
import { videoStorageRoot } from '@/lib/video-library'

export const runtime = 'nodejs'

function isInsideVideoStorage(target: string) {
  const root = path.resolve(videoStorageRoot)
  const resolved = path.resolve(target)
  return resolved === root || resolved.startsWith(`${root}${path.sep}`)
}

function openLocation(target: string) {
  if (process.platform === 'win32') {
    spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref()
    return
  }

  const command = process.platform === 'darwin' ? 'open' : 'xdg-open'
  spawn(command, [target], { detached: true, stdio: 'ignore' }).unref()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const rawPath = typeof body?.path === 'string' ? body.path : ''
  if (!rawPath) return NextResponse.json({ error: 'Path is required.' }, { status: 400 })

  const resolved = path.resolve(rawPath)
  if (!isInsideVideoStorage(resolved)) {
    return NextResponse.json({ error: 'File location is outside Raqet video storage.' }, { status: 400 })
  }

  const target = existsSync(resolved) && statSync(resolved).isFile() ? path.dirname(resolved) : resolved
  if (!existsSync(target)) return NextResponse.json({ error: 'File location does not exist.' }, { status: 404 })

  openLocation(target)
  return NextResponse.json({ ok: true })
}
