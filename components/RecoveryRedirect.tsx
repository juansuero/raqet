'use client'

import { useEffect } from 'react'

export function RecoveryRedirect() {
  useEffect(() => {
    if (!window.location.hash.includes('type=recovery')) return
    window.location.replace(`/reset-password${window.location.hash}`)
  }, [])

  return null
}
