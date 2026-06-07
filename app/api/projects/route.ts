import { NextResponse } from 'next/server'
import type { Project } from '@/lib/data'
import { deleteSoloProject, listSoloProjects, saveSoloProject } from '@/lib/solo-store'

export async function GET() {
  return NextResponse.json(listSoloProjects())
}

export async function POST(request: Request) {
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })

  const project: Project = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  }
  return NextResponse.json(saveSoloProject(project), { status: 201 })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Project id is required.' }, { status: 400 })
  deleteSoloProject(id)
  return NextResponse.json({ deletedId: id })
}
