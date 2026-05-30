# Raqet Product Brief

## Product Purpose

Raqet is a self-hosted solo tennis journal and local video review app. It helps a single player track sessions, matches, opponents, tournaments, memories, and selected point clips over time.

## Core Promise

Your private tennis journal and video review library.

## Launch Model

- Open-source self-hosted app under the Raqet name.
- Single-user solo baseline.
- SQLite by default.
- Local media storage by default.
- No hosted auth requirement.
- No invite gate.
- No billing or managed usage limits.
- Optional external AI providers configured by the self-hoster.

## Users

Serious recreational tennis players who train or compete regularly and want a private place to keep session notes, match reflections, point clips, tournament context, opponent notes, and long-term memories.

## Product Principles

- Local-first by default. Journal data and source videos stay on the self-hoster's machine unless the user explicitly configures an external provider and triggers an action.
- Solo product first. Team, coach roster, and staff workflows are not part of the default release.
- AI is optional. Raqet remains useful without Gemini, OpenAI, or any external provider.
- User review matters. AI-generated summaries, memories, and analyses should be reviewable before becoming durable context.
- Source videos are private by default. Raw full-match videos are not uploaded automatically.
- Exports and backups are first-class. The self-hoster owns the SQLite database and media files.

## Included In The Self-Hosted Solo Release

- Dashboard.
- Player profile onboarding.
- Sessions and session detail.
- Opponents.
- Tournaments and tournament matches.
- Stats and rating history.
- Memories.
- Coach-style solo insights where an external AI provider is configured.
- Settings.
- JSON export.
- Privacy and terms-style informational pages.
- Local video library.
- Point start/end marking.
- Point metadata.
- ffmpeg standard clip export.
- 9:16 reel export with manual crop keyframes.

## Optional AI

Self-hosters may configure Gemini or OpenAI. Provider costs, account security, and retention policies are the self-hoster's responsibility.

AI actions may use:

- Profile/interview text.
- Session notes or transcripts.
- Coach-style questions plus relevant local journal context.
- Explicitly exported short clips plus clip metadata.

AI actions must not automatically upload full source videos.

## Excluded From The Default Release

- Teams.
- Coach roster management.
- Hosted beta invite flow.
- Hosted auth requirement.
- Supabase database requirement.
- Sentry or Vercel Analytics requirement.
- Managed usage limits.
- Billing.
- Cloud sync.
- Raqet-hosted AI proxy.
