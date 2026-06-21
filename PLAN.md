# Raqet Self-Hosted Release Plan

Last updated: 2026-06-21

## Scope

Prepare Raqet as an open-source, self-hosted solo tennis journal and video review app.

Default release requirements:

- Single-user solo app.
- SQLite persistence by default.
- Local source video storage.
- ffmpeg-based clip and reel export.
- Optional bring-your-own Gemini or OpenAI keys.
- No required hosted auth, invite gate, Supabase project, Sentry, Vercel Analytics, managed usage limits, billing, or Raqet-hosted AI infrastructure.

## Current Release Status

- [x] README documents self-hosted setup, SQLite init, dev/build/start, ffmpeg, AI, storage paths, backup/restore, troubleshooting, and excluded hosted features.
- [x] `.env.example` contains optional placeholders only.
- [x] `.gitignore` excludes local databases, uploaded videos, exported media, logs, env files, and build output.
- [x] `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `PRIVACY.md`, and `RELEASE_CHECKLIST.md` exist.
- [x] Typecheck passes.
- [x] Production build passes.
- [x] No-cloud local smoke was verified with AI disabled.
- [x] `/team` and `/api/team` return 404 in the solo release path.

## Remaining Before Public GitHub Launch

- [x] Curate the dirty working tree into an intentional commit set.
- [x] Keep `apps/desktop` private/internal and remove it from the public repository.
- [ ] Remove or exclude Team source files from the public repository, not only runtime navigation.
- [ ] Review the large `package-lock.json` diff.
- [ ] Create a clean public repository or clean release branch.
- [ ] Run the release checklist from a fresh clone.
- [ ] Perform a manual browser smoke test for onboarding, sessions, clips, settings, export, no-AI mode, and optional provider mode.

## Public Positioning

Raqet should be promoted as:

> A self-hosted solo tennis journal and local video review app with SQLite, ffmpeg exports, and optional bring-your-own AI keys.

Do not promote it as:

- A hosted beta.
- A team management product.
- A coach marketplace.
- A managed AI service.
- A Supabase/Vercel/Sentry starter.
