# Startup And Release - Merlin Launcher

Quick guide to run, validate, build, and publish the Merlin desktop app.

## Requirements

- Windows 10/11
- Node.js 18 or newer
- npm
- Steam installed
- For native builds/installers: CMake 3.20+ and Visual Studio Build Tools 2022 with the C++ workload

## Run Locally

```powershell
cd path\to\Merlin-launcher
npm install
npm run doctor
npm start
```

Windows shortcut:

```powershell
.\start.bat
```

`start.bat` checks Node/npm, installs dependencies, runs the doctor, and starts Electron.

Staging API:

```powershell
npm run start:stage
```

Production API explicitly:

```powershell
npm run start:prod
```

## Useful Environment Variables

By default, the launcher uses `https://api-merlin.com/api`.

To point it at another API during development:

```powershell
$env:MERLIN_API_BASE_URL = "http://localhost:8787/api"
npm start
```

`npm run start:stage` sets `MERLIN_API_BASE_URL` to `https://staging.api-merlin.com/api`.

Environment behavior:

- `npm start` uses the default production API.
- `npm run start:prod` also uses production, explicitly.
- `npm run start:stage` uses staging.
- Installed builds and development builds use separate Electron data folders.
- `npm start` and `npm run start:stage` are both development commands, so refresh cached catalogs after switching between prod and staging dev runs.

Also supported:

- `MERLIN_API_URL`: overrides only the manifests endpoint.
- `MERLIN_SIMULATE_UPDATE_URL`: simulates an update when the URL is allowed by the update service.

## Pre-Release Checks

```powershell
cd path\to\Merlin-launcher
npm install
npm run doctor
npm test
```

The doctor checks Node, npm, Git, CMake, Visual Studio Build Tools, and expected DLLs in `assets/dlls`.

## Build DLLs

```powershell
npm run build:opensteamtool
```

This rebuilds only the native `OpenSteamTool` component and copies generated DLLs into `assets/dlls`.

Expected DLLs:

- `OpenSteamTool.dll`
- `dwmapi.dll`
- `xinput1_4.dll`
- `merlin-helper.dll`

## Build Installer

```powershell
npm run build
```

The installer is generated in `dist/`.

Full local release flow:

```powershell
npm run release:local
```

This runs doctor, tests, and build.

## Publish A Version

Suggested local flow:

1. Update `package.json` version.
2. Run `npm run release:local`.
3. Check the installer and `integrity.json` in `dist/`.
4. Upload the installer through Merlin Admin under Updates.
5. Validate `https://api-merlin.com/api/updates/latest`.
6. Open an older launcher version and confirm that the update prompt appears.

GitHub flow:

- The repo has `.github/workflows/release.yml`.
- On `master`, changing `package.json` version triggers the release workflow.
- The workflow creates tag `v<version>` and publishes installer + `integrity.json` to GitHub Releases.

## Post-Build Checks

- `npm test` passes.
- `npm run doctor` returns no errors.
- The installer opens on Windows.
- The app detects Steam or lets the user configure the path manually.
- License login connects to Merlin API.
- Game search, manifests, fixes, premium, polls, and updates work.
