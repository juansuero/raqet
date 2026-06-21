# Configuration

Raqet runs with no `.env` file. Create one only when you need custom paths or optional AI.

Start from:

```powershell
Copy-Item .env.example .env
```

Do not commit `.env`.

## Core Settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `RAQET_DB_PATH` | `data/raqet.sqlite` | SQLite database path. |
| `RAQET_VIDEO_STORAGE_PATH` | `data/video-library` | Source video and export storage root. |
| `FFMPEG_PATH` | `ffmpeg` on `PATH` | Optional explicit ffmpeg executable path. |
| `FFPROBE_PATH` | `ffprobe` on `PATH` | Optional explicit ffprobe executable path. |
| `RAQET_SOLO_EMAIL` | `player@localhost` | Local display email for the solo player. |
| `RAQET_SOLO_NAME` | `Player` | Local display name for the solo player. |

## AI Settings

AI is optional.

These variables matter only if you want Raqet's built-in AI actions, such as profile drafting, session debriefs, coach replies, pattern drafts, training block drafts, transcription, or selected exported clip analysis.

`RAQET_AI_PROVIDER` chooses the implemented adapter. The API key gives that adapter permission to call the external provider from your own account.

| Variable | Purpose |
| --- | --- |
| `RAQET_AI_DISABLED=true` | Force all AI actions off. |
| `RAQET_AI_PROVIDER=gemini` | Use Gemini when `GEMINI_API_KEY` is set. |
| `GEMINI_API_KEY` | Gemini API key. |
| `GEMINI_MODEL` | Gemini text/video model. |
| `RAQET_AI_PROVIDER=openai` | Use OpenAI when `OPENAI_API_KEY` is set. |
| `OPENAI_API_KEY` | OpenAI API key. |
| `OPENAI_MODEL` | OpenAI text model. |
| `OPENAI_TRANSCRIPTION_MODEL` | OpenAI transcription model. |

Currently supported provider values are `gemini` and `openai`.

If you want another provider, keep AI disabled or add another adapter in `lib/ai-provider.ts`. The local app does not require Gemini or OpenAI for journaling, import/export, stats, memory, or video review.

External provider costs, retention policies, and API key security are the operator's responsibility.

## No Hosted Services Required

The self-hosted solo release must run without:

- Supabase
- Hosted auth
- Invite gates
- Sentry
- Vercel Analytics
- Managed Raqet usage limits
- Billing
- Raqet-hosted AI proxy
