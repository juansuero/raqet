# Raqet Self-Hosted Release Guide

This guide is for preparing a public open-source release of Raqet as a solo, local-first, self-hosted tennis journal and video review app.

Raqet's default release path must not require Supabase, hosted auth, invite gates, Sentry, Vercel Analytics, managed usage limits, billing, or Raqet-hosted AI infrastructure.

## 1. Release Scope

Include:

- Solo dashboard, onboarding/profile, sessions, opponents, tournaments, stats, memories, settings, export, and legal/privacy pages.
- SQLite persistence through the local data layer.
- Local video library, source video storage, point clipping, ffmpeg clip export, and 9:16 reel export.
- Optional bring-your-own external AI provider configuration for Gemini or OpenAI.
- Setup, privacy, security, contribution, and release checklist docs.

Exclude from the public self-hosted release:

- Teams, coach roster management, staff workflows, and team navigation.
- Hosted beta invite flow.
- Hosted account/auth requirements.
- Managed Raqet usage limits or billing.
- Hosted analytics/monitoring requirements.
- Required Supabase, Sentry, Vercel, or Raqet-managed AI infrastructure.

## 2. Clean Release Branch

Create the public release from a curated branch. Do not publish a working tree containing generated local files or historical beta artifacts.

Before publishing:

```powershell
git status --short
```

Review every modified and untracked file. Keep only intentional release files.

## 3. Fresh Setup Verification

Use a separate directory or fresh clone.

```powershell
npm.cmd install
npm.cmd run db:init
npm.cmd run dev
```

Open `http://localhost:3000/dashboard`.

The app should start without:

- Supabase env vars
- Sentry env vars
- Vercel Analytics env vars
- invite/beta env vars
- Gemini or OpenAI env vars

## 4. Build Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Expected result: both pass. Node may print an experimental SQLite warning.

## 5. Browser Smoke

Verify:

- `/dashboard` loads.
- `/onboarding` saves a local player profile.
- `/sessions` and `/sessions/new` work.
- `/opponents` works.
- `/tournaments` works.
- `/stats` works.
- `/memory` works.
- `/settings` works.
- `/api/export` returns JSON.
- Team is absent from normal navigation.
- `/team` and `/api/team` return 404.

## 6. Video Workflow

Prerequisite: install `ffmpeg` and `ffprobe`, or set `FFMPEG_PATH` and `FFPROBE_PATH`.

Verify:

- `/clips` imports an MP4, MOV, MPEG, MPG, or WebM.
- Imported source video plays.
- Point start/end can be marked.
- Point result, ending, context, notes, and tags save.
- Restarting the app preserves video and clip metadata.
- Standard clip export works and the output plays.
- 9:16 reel export works with at least two crop keyframes and the output plays.
- Missing ffmpeg shows a clear error while metadata still saves.

## 7. Optional AI Verification

No-provider mode:

```powershell
$env:RAQET_AI_DISABLED="true"
npm.cmd run dev
```

Verify journaling, manual video review, stats, memories, settings, and export still work.

Provider mode:

```powershell
$env:RAQET_AI_PROVIDER="gemini"
$env:GEMINI_API_KEY="your-key"
```

or

```powershell
$env:RAQET_AI_PROVIDER="openai"
$env:OPENAI_API_KEY="your-key"
```

Verify at least one text/session AI action succeeds. If testing selected clip analysis, confirm only an explicitly exported short clip is sent after user action. Do not upload source full-match videos automatically.

External AI provider API costs are the self-hoster's responsibility.

## 8. Privacy And Security Check

Confirm:

- `.env.example` contains placeholders only.
- `.env` is not tracked.
- SQLite databases are ignored.
- Uploaded videos and exported clips/reels are ignored.
- Logs are ignored.
- Docs explain where data is stored.
- Docs explain external AI provider data/cost responsibility.
- No secrets are present in docs or source.

Recommended scan:

```powershell
rg -n "AIza[0-9A-Za-z_-]+|sk-[A-Za-z0-9_-]{10,}|gsk_[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|SENTRY_DSN|SUPABASE_SECRET_KEY" . -g "!node_modules" -g "!.next" -g "!data" -g "!.git"
```

`SENTRY_DSN` and `SUPABASE_SECRET_KEY` should not appear in active self-hosted release docs.

## 9. Publishing

Do not publish from the private development repository if it contains unrelated history, generated assets, internal experiments, or private beta context.

Recommended path:

1. Create a clean public repository, for example `raqet`.
2. Copy only the curated self-hosted release files.
3. Run fresh setup and build verification in that repository.
4. Tag the first release after verification.
5. Promote it as a self-hosted solo app, not as the old hosted beta product.
