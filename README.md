# Private News Reader

A privacy-first macOS desktop app for reading RSS/Atom feeds and tracking stocks. Zero telemetry — the only network calls are to your RSS feeds and Yahoo Finance.

## Features

- **RSS Reader** — Add feeds by URL, organize into folders, clean reading view
- **Stock Tracker** — Side panel watchlist with live quotes from Yahoo Finance
- **Keyboard-driven** — `j`/`k` navigate, `o` opens in browser, `s` stars, `r` refreshes
- **Offline-first** — All data in local SQLite, panels degrade gracefully without network
- **Dark mode** — Follows macOS system appearance automatically
- **Private** — No analytics, no tracking, no external resources, strict CSP

## Quick Start

```bash
npm install
npm run dev
```

This builds the main process, then starts three concurrent processes:
1. TypeScript compiler watching `src/main/`
2. Vite dev server for the React renderer
3. Electron loading from localhost

## Build & Package

```bash
npm run build          # Production build
npm run dist           # Build + package as .dmg
```

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
