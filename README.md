# Private News Reader

A privacy-first macOS desktop app for reading RSS/Atom feeds and tracking stocks. Zero telemetry — the only network calls are to your RSS feeds and Yahoo Finance.

## Features

- **RSS Reader** — Add feeds by URL, organize into folders, clean reading view
- **Stock Tracker** — Side panel watchlist with live quotes from Yahoo Finance
- **Keyboard-driven** — `j`/`k` navigate, `o` opens in browser, `s` stars, `r` refreshes
- **Offline-first** — All data in local SQLite, panels degrade gracefully without network
- **Dark mode** — Follows macOS system appearance automatically
- **Private** — No analytics, no tracking, no external resources, strict CSP

## Installation

### Prerequisites
- Node.js 20+
- npm

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

```bash
npm run dev
```

This builds the main process, then starts three concurrent processes:
1. TypeScript compiler watching `src/main/`
2. Vite dev server for the React renderer
3. Electron loading from localhost

## Packaging for macOS

### 1. Build and Package
To generate a production `.dmg` file:
```bash
npm run build          # Builds production assets
npm run dist           # Packages into a .dmg in the /dist folder
```

### 2. Installing the DMG
- Open the `dist/Private News Reader-X.X.X.dmg` file.
- Drag the app to your `Applications` folder.

### 3. Handling Gatekeeper (Unsigned Builds)
Since this is a private project, the build is likely unsigned. If macOS blocks it:
1. Right-click (or Control-click) the app in your Applications folder.
2. Select **Open**.
3. In the dialog that appears, click **Open** again.
4. You only need to do this once.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘+j`/`k` | Navigate articles |
| `⌘+o` | Open current article in system browser |
| `⌘+s` | Toggle star (bookmark) |
| `⌘+r` | Refresh all feeds |
| `⌘+a` (Mac) / `Ctrl+a` | Toggle "Add Feed" form |
| `⌘+d` (Mac) / `Ctrl+d` | Toggle "Add Folder" form |

## Architecture

```
Main Process (Node)          Renderer (React)
┌──────────────────┐         ┌──────────────────┐
│  SQLite (data)   │◄──IPC──►│  React UI        │
│  RSS fetching    │         │  Tailwind CSS     │
│  Stock quotes    │         │  No Node APIs     │
└──────────────────┘         └──────────────────┘
        ▲
        │ contextBridge
        │ (preload.ts)
        ▼
   window.api.*
```

All communication between processes goes through `contextBridge` and typed IPC handlers. The renderer never has access to Node APIs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron |
| UI | React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | better-sqlite3 (SQLite, WAL mode) |
| RSS | rss-parser |
| Stocks | yahoo-finance2 |
| Bundler | Vite |
| Packaging | electron-builder |

## Privacy

- Zero telemetry, analytics, or crash reporting
- Only outbound network: RSS feed URLs you configure + Yahoo Finance API
- Strict Content Security Policy — no inline scripts, no external resources
- All assets bundled locally, no CDNs
- Data stored locally in SQLite
