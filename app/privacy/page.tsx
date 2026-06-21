export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-foreground">
      <h1 className="font-display text-4xl font-bold uppercase tracking-label">Privacy</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>Raqet is a self-hosted solo tennis journal. It stores profile answers, session notes, transcripts, AI debriefs, opponent records, approved memories, tournaments, and rating history in your local SQLite database.</p>
        <p>If you configure an AI endpoint, voice audio is sent there for transcription and analysis. Raqet stores the transcript and generated debrief, but does not store raw audio after processing.</p>
        <p>Do not record other people without permission. Avoid uploading sensitive medical, financial, or third-party personal data.</p>
        <p>You can export your data in-app from Settings. Data deletion is handled by removing your local database file.</p>
      </div>
    </main>
  )
}
