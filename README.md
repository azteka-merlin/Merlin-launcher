<div align="center">

# Merlin

### Modern Electron application for Steam Lua and Manifest management

</div>

## Features

### Core Functionality
- **Integrated Web Browser** - Browse Steam Store and SteamDB directly in the app
- **Automatic App ID Detection** - Automatically detects Steam game App IDs from URLs
- **Background Downloads** - Routed through Merlin API, which handles upstream fallbacks centrally
- **Smart Steam Management** - Automatically restarts Steam after installation
- **OpenSteamTool Integration** - Builds and packages the required `OpenSteamTool.dll`, `dwmapi.dll`, and `xinput1_4.dll`

### User Experience
- **Experimental Gamepad Support** - Control the entire app with Xbox/PlayStation controllers
- **Multi-language** - Available in Brazilian Portuguese, English, French, Spanish, and German
- **Modern UI** - Clean, minimalist design with smooth transitions
- **Protected License Activation** - A desktop activation gate validates the license against the current computer before opening the app

### License and Device Reset

Merlin binds an activated license to one computer. If the user changes or
formats the computer, the activation gate offers **Reset device** after a valid
license key is entered. A reset disconnects the prior computer, clears the
local session, and requires an explicit new key validation to bind the current
computer. Each license can request one reset every 30 days; when unavailable,
the app shows the next available date in Brasília time.

### Technical
- Built with **Electron 33** for cross-platform desktop experience
- **Chromium-based** web browsing for optimal compatibility
- **IPC architecture** for secure communication
- Build-time JavaScript obfuscation and hardened Electron Fuses

---

## Requirements

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Steam** installed on your system
- **Windows 10/11** (Linux/macOS support planned)
- To build from source: **CMake 3.20+**, **Visual Studio Build Tools 2022**
  with the C++ workload, and a Windows SDK

---

## Installation

### Option 1: Executable (Recommended)

Download the latest installer from the [releases](https://github.com/azteka-merlin/Merlin-launcher/releases) page and run it.

The Windows installer requests administrator permission. If Steam is found at
the default `C:\Program Files (x86)\Steam` location, it automatically installs
the generated `OpenSteamTool.dll`, `dwmapi.dll`, and `xinput1_4.dll` there. Steam installations in
custom locations can still be configured and repaired from inside Merlin.

### Option 2: From Source

1. **Clone the repository**
```bash
   git clone https://github.com/azteka-merlin/Merlin-launcher.git
   cd Merlin-launcher
```

2. **Install dependencies**
```bash
   npm install
```

3. **Run the application**
```bash
   npm start
```

Development API targets:

```bash
npm start
npm run start:prod
npm run start:stage
```

- `npm start` keeps the default production API: `https://api-merlin.com/api`.
- `npm run start:prod` is the explicit production dev command.
- `npm run start:stage` points the launcher to `https://staging.api-merlin.com/api`.
- Installed builds and development builds use separate Electron data folders. `npm start` and `npm run start:stage` are both development commands, so refresh cached catalogs after switching between them.

### Option 3: Quick Start (Windows)

Simply double-click `start.bat` - it will automatically:
- Check for Node.js installation
- Install or update Node.js dependencies
- Validate the local `.env` and generate the encrypted development security bundle
- Check that the required OpenSteamTool DLLs are available
- Launch the application

The launcher prepares everything required to **run** Merlin. Building the native
DLLs still requires CMake and Visual Studio Build Tools 2022; if they are absent,
the launcher shows the command that must be run after installing those tools.

### Option 4: Build Executable

```bash
npm run build
```
This first builds the Release version of `OpenSteamTool.dll`, `dwmapi.dll`, and `xinput1_4.dll`, copies
them to `assets/dlls`, then packages those generated DLLs with Merlin. The `.exe`
file will be generated in the `dist/` folder.

To build only the DLLs during development:

```bash
npm run build:opensteamtool
```

### Release procedure

Use this procedure for a launcher update. The executable is built in this
repository; the Admin only receives the finished installer for distribution.

1. Confirm that no prior `node`, `electron-builder`, `7za`, or `makensis`
   process from this repository is still building. Do not start a second build
   while one is active: concurrent builds contend for `dist/win-unpacked` and
   can produce an invalid installer.
2. Run the test suite:

   ```bash
   npm test
   ```

3. Run this command exactly once and wait for it to finish:

   ```bash
   npm run build:release
   ```

   It increments the patch version in `package.json`, rebuilds the native
   DLLs, and creates `dist/Merlin Setup <version>.exe`. Console output being
   truncated is not completion; verify that the build process has exited and
   that the expected `.exe` exists.
4. Verify the installer contains the current `OpenSteamTool.dll`,
   `dwmapi.dll`, `xinput1_4.dll`, and `merlin-helper.dll` under
   `dist/win-unpacked/resources/dlls` before publishing.
5. Commit the release, create and push the matching Git tag (for example,
   `v1.6.7`), create the GitHub release with the installer attached, then
   upload that same installer and version in the Admin update screen.

`npm run build:release` deliberately uses `--no-git-tag-version`; it changes
the package version but does **not** create the Git tag automatically.

---

## Usage

### Initial Setup

1. **Launch the application**
2. Click **"Auto Detect"** to find your Steam installation
3. If detection fails, use **"Browse"** to manually select your Steam folder

### Adding a Game

1. **Navigate** to a game page on Steam Store or SteamDB
2. The **App ID** will be detected automatically
3. Click **"Add to Steam"**
4. Wait for download and installation to complete
5. Click **"Restart Steam"** to see the game in your library

### Supported File Types

| File | Destination |
|------|-------------|
| `.manifest` | `Steam\depotcache\` |
| `.lua` | `Steam\config\stplug-in\` |

Before installing a `.lua` file, Merlin comments out every active line containing
`setmanifestid(` by prefixing the whole line with `--`. Lines already commented
remain unchanged.

---

## Gamepad Support (Experimental)

| Button | Action |
|--------|--------|
| **A** (Xbox) / **✕** (PS) | Select highlighted element |
| **B** (Xbox) / **○** (PS) | Back |
| **X** (Xbox) / **□** (PS) | Add to Steam |
| **Y** (Xbox) / **△** (PS) | Restart Steam |
| **D-Pad Up/Down** | Navigate UI elements |
| **D-Pad Left/Right** | Web navigation (Back/Forward) |
| **LB/RB** | Scroll page |
| **Start** | Home |
| **Left Stick** | Scroll page |

Connect your controller before launching the app. The controller indicator will appear when detected.

---

## Languages

- 🇧🇷 **Português (Brasil)**
- 🇬🇧 **English**
- 🇫🇷 **Français**
- 🇪🇸 **Español**
- 🇩🇪 **Deutsch**

Change language via the dropdown in the top-right corner.

---

## Tech Stack

- **[Electron](https://www.electronjs.org/)** - Desktop application framework
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[Axios](https://axios-http.com/)** - HTTP client for downloads
- **[AdmZip](https://www.npmjs.com/package/adm-zip)** - ZIP file extraction
- **Gamepad API** - Native controller support
- **WebView** - Integrated web browsing

---

## Project Structure

```text
Merlin/
|-- assets/             Icons and generated DLLs used by the application
|-- OpenSteamTool/      Native C++ component and its build system
|-- scripts/            Electron packaging and hardening hooks
|-- src/
|   |-- main/           Config, Steam, downloads, DLLs, security, and IPC modules
|   `-- renderer/       Feature-specific renderer modules
|-- test/               Node regression and contract tests
|-- build.js            OpenSteamTool + Electron secured build pipeline
|-- main.js             Electron composition and application lifecycle
|-- preload.js          Restricted IPC bridge
|-- renderer.js         Existing Steam browsing interface logic
`-- package.json        Node.js dependencies, tests, and packaging configuration
```

---

## Credits

### OpenSteamTool

Merlin integrates and distributes DLLs built from the internalized
[OpenSteamTool](./OpenSteamTool) core.

This native component comes from the OpenSteamTool codebase and uses
third-party components including Microsoft Detours, Lua, spdlog, toml++, and
Protocol Buffers.

### License notice

OpenSteamTool and the DLLs generated from it are distributed under the
**GNU General Public License v3.0**. Other Merlin components and third-party
dependencies retain their respective licenses.
