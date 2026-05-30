# Self-Hosted Release Checklist

Use this checklist before tagging or publishing an open-source self-hosted Raqet release.

## Setup

- [ ] Fresh checkout installs with `npm.cmd install`.
- [ ] `npm.cmd run db:init` creates `data/raqet.sqlite`.
- [ ] `npm.cmd run dev` starts without Supabase, hosted auth, invite, Sentry, Analytics, usage-limit, Gemini, or OpenAI env vars.
- [ ] `npm.cmd run typecheck` passes.
- [ ] `npm.cmd run build` passes.
- [ ] `npm.cmd run start` serves the built app.

## Browser Smoke

- [ ] `/dashboard` loads.
- [ ] `/onboarding` saves a local player profile.
- [ ] `/sessions` and `/sessions/new` work.
- [ ] `/opponents` works.
- [ ] `/tournaments` works.
- [ ] `/stats` works.
- [ ] `/memory` works.
- [ ] `/settings` works.
- [ ] `/api/export` returns a JSON export.
- [ ] Team is absent from normal navigation.
- [ ] `/team` and `/api/team` return 404.

## Video Workflow

- [ ] `/clips` imports an MP4, MOV, MPEG, MPG, or WebM.
- [ ] Imported source video plays in the browser.
- [ ] Point start/end can be marked.
- [ ] Point result, ending, context, notes, and tags save to SQLite.
- [ ] Restarting the app preserves video and clip metadata.
- [ ] Standard clip export works with ffmpeg and the output plays.
- [ ] 9:16 reel export works with at least two crop keyframes and the output plays.
- [ ] Missing ffmpeg shows a clear error and metadata still saves.

## AI

- [ ] With no provider configured, journaling, video review, stats, memories, settings, and export still work.
- [ ] `/settings` shows AI as not configured and does not expose keys.
- [ ] With a real Gemini key, at least one text/session AI action succeeds.
- [ ] With a real OpenAI key, at least one text/session AI action succeeds.
- [ ] Provider failure returns a clear redacted error and does not corrupt local data.
- [ ] Selected clip AI sends only an exported short clip after explicit user action.
- [ ] Raw source full-match videos are not automatically uploaded.

## Privacy And Packaging

- [ ] `.env.example` contains placeholders only.
- [ ] `.gitignore` excludes local DBs, videos, exported media, logs, build output, and secrets.
- [ ] README documents setup, build/start, ffmpeg, AI, storage paths, backup/restore, troubleshooting, excluded hosted features, and excluded Team features.
- [ ] `PRIVACY.md` states local storage behavior and external AI cost responsibility.
- [ ] `SECURITY.md` includes private vulnerability reporting instructions.
- [ ] `CONTRIBUTING.md` states solo self-hosted scope.
