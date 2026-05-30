# Contributing To Raqet

Raqet's open-source baseline is a self-hosted solo tennis journal and video review app.

## Scope

Good first contributions:

- Solo journaling, tournaments, opponents, stats, memories, settings, export, and local video review.
- SQLite-backed persistence.
- Clear setup docs and local-first privacy improvements.
- Optional external AI provider adapters that do not require hosted Raqet infrastructure.
- Bug fixes and focused tests for the solo product path.

Out of scope for the default release:

- Teams, coach roster management, or team staff workflows.
- Hosted beta invite gates.
- Managed usage limits or billing.
- Hosted analytics, Sentry, or required Supabase auth/database.
- Cloud sync as a default requirement.

## Local Development

```powershell
npm.cmd install
npm.cmd run db:init
npm.cmd run dev
```

Run before opening a pull request:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

If your change touches video export, verify ffmpeg behavior. If your change touches AI, verify the no-provider path still works.

## Data And Secrets

Do not commit:

- `.env` files
- SQLite databases
- uploaded source videos
- exported clips/reels
- logs
- real API keys or provider responses containing private user data

Use `.env.example` for placeholder configuration only.

## Pull Request Notes

Keep changes focused. Include:

- What changed
- Commands run
- Browser smoke evidence for UI changes
- Any remaining limitations or manual prerequisites
