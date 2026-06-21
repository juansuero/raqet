# Installation

This guide installs Raqet as a local self-hosted solo app.

## Requirements

- Node.js 22 or newer.
- npm.
- Optional: `ffmpeg` and `ffprobe` for video probing, clip export, highlight export, and 9:16 reel export.
- Optional: external AI endpoint credentials if you want the built-in AI actions.

## AI-Assisted Install

If you use an AI coding assistant, you can just copy this repo's link into your AI and ask it to install it:

```text
https://github.com/juansuero/raqet
```

A useful prompt:

```text
Install this repo locally, run the setup commands, start the app, and tell me the local URL.
```

The manual commands are below.

## Local Setup

```powershell
npm.cmd install
npm.cmd run db:init
npm.cmd run dev
```

Open `http://localhost:3000/dashboard`.

The app starts without Supabase, hosted auth, invite, Sentry, Analytics, or external AI env vars.

## Production Mode

```powershell
npm.cmd run build
npm.cmd run start
```

Use the package scripts instead of calling Next.js directly. The build script uses webpack intentionally.

## Custom Data Paths

SQLite defaults to `data/raqet.sqlite`. Video storage defaults to `data/video-library`.

To override them:

```powershell
$env:RAQET_DB_PATH="D:/raqet/raqet.sqlite"
$env:RAQET_VIDEO_STORAGE_PATH="D:/raqet/video-library"
npm.cmd run db:init
npm.cmd run dev
```

Use the same env vars when starting production.

## ffmpeg

If `ffmpeg` and `ffprobe` are not on `PATH`, set explicit paths:

```powershell
$env:FFMPEG_PATH="C:/tools/ffmpeg/bin/ffmpeg.exe"
$env:FFPROBE_PATH="C:/tools/ffmpeg/bin/ffprobe.exe"
```

Raqet can still save video metadata without ffmpeg. Export features require ffmpeg.

## Verify

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Then run the browser checks listed in the README verification section.
