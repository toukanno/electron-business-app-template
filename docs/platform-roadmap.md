# Platform Roadmap

## Current status

- Windows: buildable now with `npm run dist:win`
- macOS: packaging config added, but final app build and signing must be done on macOS
- iOS: not supported by Electron directly

## Defined issues

1. Stabilize desktop release flow
   - Run `npm test` and `npm run build` in CI
   - Add notarization and code-sign settings for macOS release
   - Verify SQLite database path and CSV export behavior on macOS

2. Separate mobile delivery strategy
   - Extract renderer into a reusable web shell
   - Replace Electron-only APIs with an adapter layer
   - Evaluate `Capacitor` for iOS packaging
   - Rework file export and local database access for mobile sandbox rules

3. Overnight maintenance loop
   - Re-run tests and build on a schedule
   - Record failures and changed files
   - Stop auto-commits unless the working tree is verified clean and tests are green

## Notes

- Building a `.app` or `.dmg` for macOS from Windows is not a reliable release path.
- Shipping to iOS requires a separate app target and Apple signing pipeline.
