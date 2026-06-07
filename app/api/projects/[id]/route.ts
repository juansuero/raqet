import { NextResponse } from 'next/server'
import { deleteSoloProject, getSoloProject, saveSoloProject } from '@/lib/solo-store'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const existing = getSoloProject(id)
  if (!existing) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

  const name = typeof body.name === 'string' ? body.name.trim() : existing.name
  return NextResponse.json(saveSoloProject({ ...existing, name }))
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const existing = getSoloProject(id)
  if (!existing) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  deleteSoloProject(id)
  return NextResponse.json({ deletedId: id })
}
