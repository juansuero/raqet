# Self-Hosted Release Checklist

Use this checklist before tagging or publishing an open-source self-hosted Raqet release.

## Setup

- [ ] Fresh checkout installs with `npm.cmd install`.
- [ ] `npm.cmd run db:init` creates `data/raqet.sqlite`.
- [ ] `npm.cmd run dev` starts without Supabase, hosted auth, invite, Sentry, Analytics, usage-limit, or external AI env vars.
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
- [ ] `/patterns` works.
- [ ] `/training-plan` works.
- [ ] `/settings` works.
- [ ] `/api/export` returns a JSON export.
- [ ] `/onboarding` imports a JSON export by file picker.
- [ ] `/onboarding` imports a JSON export by drag-and-drop.
- [ ] `/settings` imports a JSON export by file picker.
- [ ] `/settings` imports a JSON export by drag-and-drop.
- [ ] Team is absent from normal navigation.
- [ ] `/team` and `/api/team` return 404.

## Video Workflow

- [ ] `/clips` imports an MP4, MOV, MPEG, MPG, or WebM.
- [ ] Imported source video plays in the browser.
- [ ] Point start/end can be marked.
- [ ] Point result, ending, context, notes, and tags save to SQLite.
- [ ] Restarting the app preserves video and clip metadata.
- [ ] Standard clip export works with ffmpeg and the output plays.
- [ ] Batch highlight export works or shows a clear ffmpeg/error prerequisite.
- [ ] 9:16 reel export works with at least two crop keyframes and the output plays.
- [ ] Missing ffmpeg shows a clear error and metadata still saves.
- [ ] Clip forms fit on narrow screens; start/end boxes do not overflow the viewport.

## AI

- [ ] With no AI endpoint configured, journaling, video review, stats, memories, settings, and export still work.
- [ ] `/settings` shows AI as not configured and does not expose keys.
- [ ] With a real compatible text endpoint, at least one text/session AI action succeeds.
- [ ] Endpoint failure returns a clear redacted error and does not corrupt local data.
- [ ] Without `RAQET_AI_VIDEO_ENDPOINT`, selected clip AI shows a clear unavailable/error state.
- [ ] With `RAQET_AI_VIDEO_ENDPOINT`, selected clip AI sends only an exported short clip after explicit user action.
- [ ] Raw source full-match videos are not automatically uploaded.

## Import And Export

- [ ] Hosted `/api/export` downloads a `.json` file instead of requiring copy/paste.
- [ ] Self-hosted `/api/export` downloads a `.json` file.
- [ ] Import summary reports counts for imported records.
- [ ] Invalid JSON shows a visible error.
- [ ] Import docs explain that source videos are not embedded in JSON exports.

## Privacy And Packaging

- [ ] `.env.example` contains placeholders only.
- [ ] `.gitignore` excludes local DBs, videos, exported media, logs, build output, and secrets.
- [ ] README documents setup, build/start, ffmpeg, AI, storage paths, backup/restore, troubleshooting, excluded hosted features, and excluded Team features.
- [ ] `PRIVACY.md` states local storage behavior and external AI cost responsibility.
- [ ] `SECURITY.md` includes private vulnerability reporting instructions.
- [ ] `SUPPORT.md` explains where to ask for help.
- [ ] `CHANGELOG.md` lists the initial release contents.
- [ ] `CONTRIBUTING.md` states solo self-hosted scope.
- [ ] `.github` issue templates and pull request template are present.
- [ ] `package.json` repository, bugs, homepage, and license fields point to the personal public repository.

## GitHub Release

- [ ] `git remote -v` points to `git@github-personal:juansuero/raqet.git`.
- [ ] Personal GitHub SSH auth works with `ssh -T git@github-personal`.
- [ ] Release branch contains no generated DBs, videos, logs, `.env`, `.next`, or `node_modules`.
- [ ] Fresh clone verification passes before tagging.
- [ ] Tag `v0.1.0` is pushed only after verification.
- [ ] GitHub release notes are created from `CHANGELOG.md`.
