# Building minecrAft installers

The app is an Electron desktop game. The packaging config (electron‑builder) is already set up in `package.json`, with an app icon at `build/icon.png`.

## One‑time setup
```bash
cd minecraAft
npm install
```

## Run it (no build needed)
```bash
npm start            # launches the game in the Electron window
```
Or play in a browser: run `src/serve.command` and open `http://localhost:8123/index.html`.

## Build installers
```bash
npm run dist:mac     # → dist/minecrAft - Adyah's Adventure-1.0.0.dmg   (run on a Mac)
npm run dist:win     # → dist/ ... Setup .exe and a portable .exe        (run on Windows, or via Wine)
npm run dist:all     # mac + win together (best run on macOS)
```
Outputs land in the `dist/` folder.

## Honest notes
- **A macOS `.dmg` must be built on macOS.** It can't be produced on Linux/Windows. On your Mac, `npm run dist:mac` produces the `.dmg` directly.
- **Code signing / notarization is not configured.** The `.dmg`/`.exe` will run, but on first launch macOS Gatekeeper may say "unidentified developer" — right‑click → Open to bypass (this is normal for unsigned personal apps). Proper signing needs an Apple Developer certificate.
- **Windows `.exe`** can be built on Windows directly, or from macOS/Linux if Wine is installed (electron‑builder handles it).
- If you don't want to build anything, the one‑click launchers already work: double‑click `Play-minecrAft.command` (Mac) or `Play-minecrAft.bat` (Windows).
