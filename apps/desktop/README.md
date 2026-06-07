# Raqet Desktop MVP

This is the first Tauri spike for Raqet Desktop.

## What Works In This MVP

- Import a local tennis video.
- Play the video locally.
- Mark point start and end.
- Save point metadata locally.
- Export a short clip with system `ffmpeg` when available.
- Export an Instagram-ready 9:16 reel from a saved clip using manual crop keyframes.
- Store the local library in the app data directory as `library.json`.

## What Is Intentionally Not Included Yet

- AI analysis.
- Supabase sync.
- Account login.
- Automatic point detection.
- SQLite.
- Bundled ffmpeg.
- Full-video upload.

## Requirements

- Node.js.
- Rust and Cargo.
- Tauri prerequisites for Windows.
- `ffmpeg` on PATH for clip export.

Install Rust from:

```text
https://www.rust-lang.org/tools/install
```

Install ffmpeg and make sure this works:

```powershell
ffmpeg -version
```

## Install

```powershell
cd apps/desktop
npm.cmd install --cache ..\..\.npm-cache
```

## Frontend Build Check

```powershell
npm.cmd run build
```

## Tauri Dev

```powershell
npm.cmd run tauri:dev
```

## Tauri Build

```powershell
npm.cmd run tauri:build
```

## Instagram Reel Export

The reel exporter is intentionally assisted instead of fully automatic. Current computer-vision tracking is not reliable enough for fast side-to-side movement, so the release path is manual keyframes with smooth interpolation.

Workflow:

1. Create and export a normal point clip first.
2. Open the clip in `Clips & Timeline`.
3. Scrub to the start of the point.
4. Move the reel crop slider until the player is inside the vertical frame.
5. Click `Add Keyframe`.
6. Add more keyframes whenever the player changes direction or moves quickly across the court.
7. Add one final keyframe near the end of the clip.
8. Click `Export Reel`.
9. Use `Open Reel Folder` from the status message to find the exported MP4.

Minimum useful setup: one keyframe near the start and one near the end. Better reels usually need 3-6 keyframes across a 20-30 second point.

## MVP Verification

1. Open the desktop app.
2. Import an MP4, MOV, MPEG, or WebM file.
3. Play the video.
4. Mark a start timestamp.
5. Mark an end timestamp after the start.
6. Fill point result, ending, shot context, notes, and tags.
7. Save and export the clip.
8. Confirm the clip appears in the local clip list.
9. Restart the app.
10. Confirm the imported video and clip metadata are still present.
11. Select an exported clip.
12. Add at least two reel keyframes.
13. Export a reel and confirm it plays as a 9:16 MP4.

If `ffmpeg` is missing, the metadata should still save, but `exportedClipPath` will be empty.
