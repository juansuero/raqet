import { NextResponse } from 'next/server'
import { aiProviderStatus } from '@/lib/ai-provider'

export async function GET() {
  return NextResponse.json(aiProviderStatus())
}
