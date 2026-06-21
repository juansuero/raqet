# Support

Use GitHub issues for reproducible bugs, setup problems, and focused feature requests.

Before opening an issue:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Include:

- Operating system and Node.js version.
- Exact command or route that failed.
- Visible error message.
- Whether `RAQET_DB_PATH`, `RAQET_VIDEO_STORAGE_PATH`, `FFMPEG_PATH`, or `FFPROBE_PATH` is customized.
- Whether AI is disabled, not configured, or configured with an external endpoint.

Do not include API keys, `.env` contents, private journal exports, raw full-match videos, or logs containing private data.

Security issues should be reported privately using [SECURITY.md](SECURITY.md).
