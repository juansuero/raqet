# Import And Export

Raqet exports local app data as JSON and imports that JSON into the self-hosted SQLite database.

## Export

Open:

```text
/api/export
```

The API returns a JSON download named like:

```text
raqet-export-2026-06-21.json
```

The export can include:

- Player profile
- Sessions
- Opponents
- Tournaments
- Tournament matches
- Memories
- Coach messages
- Rating history
- Projects
- Clips
- Patterns
- Training blocks
- Session training block links
- Local video metadata

Local source video files and exported media files are not embedded in the JSON file. Back up `data/video-library` separately.

## Import

Use either:

- `/onboarding` on first setup.
- `/settings` after setup.

Drag the JSON file into the **Import JSON** area, or choose it with the file picker.

The import merges records by ID. Existing records with the same IDs are updated.

## Hosted To Self-Hosted Migration

1. In the hosted Raqet app, use **Export Data** or open `/api/export`.
2. Save the downloaded `.json` file.
3. Start the self-hosted app.
4. Open `/onboarding`.
5. Drop the JSON file into the import area.
6. Review the visible import summary.
7. Back up or manually re-import source video files, because JSON exports do not contain video binaries.

## Error Handling

Invalid JSON, unsupported files, or server failures should show a visible UI error. Import should not fail silently.

If an import fails, the safest recovery path is:

```powershell
Copy-Item data/raqet.sqlite C:/backups/raqet-before-retry.sqlite
```

Then retry with the original export file after fixing the error.
