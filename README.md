# Hoffman Reader

A privacy-first macOS desktop app for reading RSS/Atom feeds and tracking stocks. Zero telemetry — the only network calls are to your RSS feeds and Yahoo Finance.

## Features

- **RSS Reader** — Add feeds by URL, organize into folders, clean reading view
- **Stock Tracker** — Side panel watchlist with live quotes from Yahoo Finance
- **Intelligent Responsive UI** — Panels automatically shrink or collapse as you resize the window. The stock panel transforms into a compact ticker view.
- **Backup & Restore** — Export your entire configuration (feeds, folders, stocks) to a portable `.json` file and import it back anytime.
- **Keyboard-driven** — `⌘+j`/`k` navigate, `⌘+o` opens in browser, `⌘+s` stars, `⌘+r` refreshes, `⌘+t` adds stock
- **Offline-first** — All data in local SQLite, panels degrade gracefully without network
- **Dark mode** — Follows macOS system appearance automatically
- **Private** — No analytics, no tracking, no external resources, strict CSP

## Usage

### Managing Feeds & Stocks
- **Add Feed**: Press `⌘+A` or use the sidebar "+" button.
- **Add Folder**: Press `⌘+D` or use the sidebar folder icon.
- **Add Stock**: Press `⌘+T` or use the "+ Add Stock" button in the right panel.
- **Export/Import**: Open Settings (⚙ icon in sidebar) to backup your configuration to a `.json` file. This makes it easy to sync between machines or keep a safe copy of your reading list.

### Responsive Panels
The UI is designed to stay functional even in narrow windows:
- **Stock Panel**: When the panel is narrow (< 160px), it collapses into a "Ticker" view. Click a ticker to toggle between price change ($) and percentage (%). Click the symbol to see full details in a hover popup (dismiss with `Esc`).
- **Sidebar**: Automatically hides when the window is narrow, maximizing space for articles.
- **Navigation**: In narrow views, a "Back" button appears in the article view to return to the list.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘+j` / `⌘+k` | Navigate to next/previous article |
| `⌘+o` | Open current article in system browser |
| `⌘+s` | Toggle star (bookmark) |
| `⌘+r` | Refresh all feeds |
| `⌘+t` | Toggle "Add Ticker" form |
| `⌘+a` | Toggle "Add Feed" form |
| `⌘+d` | Toggle "Add Folder" form |
| `Esc` | Close popups or settings |

*Note: Use `Ctrl` instead of `⌘` on Windows/Linux.*

## Why Hoffman Reader?

Most news readers today are filled with tracking pixels, targeted ads, and "recommended content" algorithms. **Hoffman Reader** is different. It's a tool for intentional reading. No one knows what you read, what stocks you watch, or how often you check them. It's just you and your sources.

**Built with ❤️ for privacy enthusiasts.** If you like this project, feel free to share it with others who value digital autonomy.

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
