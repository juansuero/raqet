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

Raqet uses a provider-agnostic HTTP adapter. Point it at any service, local gateway, proxy, or workflow that exposes a compatible endpoint contract.

| Variable | Purpose |
| --- | --- |
| `RAQET_AI_DISABLED=true` | Force all AI actions off. |
| `RAQET_AI_API_KEY` | Secret token sent as `Authorization: Bearer ...`. |
| `RAQET_AI_BASE_URL` | Base URL for chat and transcription endpoints. |
| `RAQET_AI_TEXT_ENDPOINT` | Optional full URL for text generation. Defaults to `${RAQET_AI_BASE_URL}/chat/completions`. |
| `RAQET_AI_MODEL` | Text model name understood by your endpoint. |
| `RAQET_AI_TRANSCRIPTION_ENDPOINT` | Optional full URL for audio transcription. Defaults to `${RAQET_AI_BASE_URL}/audio/transcriptions`. |
| `RAQET_AI_TRANSCRIPTION_MODEL` | Transcription model name understood by your endpoint. |
| `RAQET_AI_VIDEO_ENDPOINT` | Optional full URL for selected clip video analysis. Required only for video AI. |
| `RAQET_AI_VIDEO_MODEL` | Optional video model name. Defaults to `RAQET_AI_MODEL`. |

Text generation uses a chat-completions-style JSON request:

```json
{
  "model": "your-model",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.2,
  "response_format": { "type": "json_object" }
}
```

Transcription uses `multipart/form-data` with `file`, `model`, and `response_format=json`.

Selected clip video analysis posts JSON to `RAQET_AI_VIDEO_ENDPOINT` with `model`, `systemInstruction`, `mimeType`, `dataBase64`, `text`, `temperature`, and `responseFormat`.

The local app does not require AI for journaling, import/export, stats, memory, or video review.

External endpoint costs, retention policies, and API key security are the operator's responsibility.

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
