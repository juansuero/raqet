# Raqet Privacy Model

Raqet is designed as a local-first, self-hosted solo tennis journal and video review app.

## What Stays Local By Default

The default app path stores data on the self-hoster's machine:

- Player profile and onboarding answers
- Session journal entries and transcripts
- Opponents, tournaments, tournament matches, stats, rating history, and memories
- Patterns and training blocks
- Coach chat history
- Imported source videos
- Exported point clips and 9:16 reels
- SQLite metadata

There is no default hosted Raqet account, invite gate, analytics service, Sentry project, Supabase database, managed usage meter, or Raqet-hosted AI proxy.

## Storage Locations

Defaults:

- SQLite database: `data/raqet.sqlite`
- Source videos: `data/video-library/sources`
- Exported point clips: `data/video-library/exports/clips`
- Exported 9:16 reels: `data/video-library/exports/reels`

Configurable paths:

- `RAQET_DB_PATH`
- `RAQET_VIDEO_STORAGE_PATH`

Deleting clip metadata in the app does not delete the source video or exported media files.

## External AI Providers

AI is optional. If no provider is configured, the app remains usable for journaling, manual video review, stats, memories, patterns, training blocks, settings, import, and export.

If the self-hoster configures Gemini or OpenAI, selected AI actions may send content to that provider:

- Profile/interview text for profile compilation
- Session notes or transcripts for debriefs
- Coach questions plus relevant local journal context
- An explicitly exported short clip plus clip metadata when the user clicks selected clip analysis

Raqet does not automatically upload raw source full-match videos. Raw clip upload analysis is disabled in the self-hosted build.

External AI provider API costs, retention policies, and account security are the self-hoster's responsibility.

## Backups

Back up the SQLite database and video storage directory together. Stop the app before copying live files.

JSON exports do not contain source video binaries or exported media files. Back up the video storage directory separately.

## Logs

Logs should not contain API keys or full provider request payloads. Local filesystem paths may appear in user-visible storage information and file operation errors where needed to help the self-hoster manage their own files.
