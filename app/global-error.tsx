'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <main className="min-h-screen bg-background p-6 text-foreground">
          <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">{error.message || 'Raqet hit an unexpected local runtime error.'}</p>
          {error.stack && (
            <details className="mt-4 max-w-3xl rounded-lg border border-border bg-surface p-3 text-left">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Error details</summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted">{error.stack}</pre>
            </details>
          )}
          <button type="button" onClick={reset} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
