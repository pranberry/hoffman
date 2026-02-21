Prompt:
I want to build a macOS RSS reader + stock tracker desktop app using Electron + TypeScript. I'm a backend/web dev comfortable with TypeScript but new to Electron. Help me scaffold and build this app step by step.
Core features:
RSS Panel:

Add/manage RSS feeds by URL, organized into folders
Fetch and parse RSS/Atom feeds (rss-parser)
Clean, distraction-free article reading view
Keyboard-driven navigation (j/k to move between articles, o to open in browser, r to refresh)
Mark articles read/unread, star/save articles

Stock Panel:

Small side panel for a personal stock watchlist
Fetch data using yahoo-finance2 npm package (no API key required)
Display: current price, daily change ($ and %), sparkline if feasible
RSS and stock panels poll on independent intervals and never block each other

General:

Offline-first — all panels degrade gracefully with no network
Respects macOS system dark/light mode via prefers-color-scheme
All data stored locally in SQLite via better-sqlite3

Tech stack:

Electron + TypeScript (strict mode)
React for UI
Tailwind CSS with CSS variables for dark/light theming
better-sqlite3 for SQLite
rss-parser for feed parsing
yahoo-finance2 for stock quotes
electron-builder configured to produce a .dmg for easy macOS distribution

Architecture:

Main process: SQLite, feed fetching, stock API calls
Renderer process: React UI only
contextBridge + ipcMain/ipcRenderer for all main↔renderer communication — no raw Node APIs exposed to renderer
Panel-based layout — RSS and stock are independent modules so new panels can be added later without touching existing ones

Privacy — strictly enforced:

Zero telemetry, analytics, or crash reporting — nothing phones home
The only outbound network calls are: user-configured RSS feed URLs and Yahoo Finance stock quotes via yahoo-finance2
Lock down the renderer with a strict Content Security Policy — no inline scripts, no external resources, all assets bundled locally
No third-party CDNs anywhere

Developer experience:

npm install && npm run dev should be all it takes to get running
Document the setup clearly in README.md
npm run dist produces a signed-ready .dmg via electron-builder

Start by:

Scaffold the full project structure with all dependencies
Working Electron + React + TypeScript dev server
SQLite schema design (feeds, articles, read state, stock watchlist)
Build features one at a time, explaining key Electron concepts (main/renderer, IPC, contextBridge) as they come up
Generate a CLAUDE.md from it once the project is scaffolded — that way the privacy rules, architecture decisions, and panel conventions are baked into every future session automatically.