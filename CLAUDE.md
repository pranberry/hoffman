# CLAUDE.md — Private News Reader

## What is this?
A privacy-first macOS desktop app for reading RSS feeds and tracking stocks. Built with Electron, React, TypeScript, and SQLite. Zero telemetry — the only outbound network calls are RSS fetches and Yahoo Finance quotes.

## Architecture

### Process model
- **Main process** (`src/main/`): SQLite database, feed fetching (rss-parser), stock quotes (yahoo-finance2), all Node/system APIs
- **Renderer process** (`src/renderer/`): React UI only — no Node APIs, no direct network access
- **Preload** (`src/main/preload.ts`): contextBridge exposing a typed `window.api` — the ONLY bridge between main and renderer
- **Shared types** (`src/shared/types.ts`): Type definitions used by both processes

### IPC rules
- All main↔renderer communication goes through `ipcMain.handle` / `ipcRenderer.invoke`
- Channels are defined in `src/main/ipc.ts` and exposed via `src/main/preload.ts`
- Never expose raw `ipcRenderer` or Node APIs to the renderer
- The renderer accesses everything through `window.api.*`

### Panel architecture
- RSS and Stocks are independent panel modules in `src/renderer/components/rss/` and `src/renderer/components/stocks/`
- Each panel manages its own state, data fetching intervals, and error handling
- Panels never import from each other
- To add a new panel: create `src/renderer/components/<panel>/`, add it to `App.tsx`

## Privacy rules — STRICTLY ENFORCED
- Zero telemetry, analytics, or crash reporting — nothing phones home
- Only outbound network: user-configured RSS feed URLs + Yahoo Finance quotes
- Strict CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`
- No third-party CDNs, external scripts, or remote resources
- All assets bundled locally
- Navigation to external URLs blocked inside the app window (external links open in system browser via `shell.openExternal`)
- Never add analytics, tracking pixels, error reporting services, or any external service

## Tech stack
- **Electron** — desktop shell
- **React 19** — UI
- **TypeScript** (strict mode) — all code
- **Tailwind CSS v4** — styling, dark/light via `prefers-color-scheme`
- **better-sqlite3** — local SQLite database (WAL mode)
- **rss-parser** — RSS/Atom feed parsing
- **yahoo-finance2** — stock quotes (ESM-only, loaded via dynamic import)
- **Vite** — renderer bundler
- **electron-builder** — .dmg packaging

## Database
- SQLite via better-sqlite3, stored in Electron's `userData` directory
- Schema in `src/main/database.ts`: `folders`, `feeds`, `articles`, `watchlist`
- WAL mode enabled for concurrent reads/writes
- Foreign keys enforced

## Key conventions
- Renderer types for `window.api` declared in `src/renderer/global.d.ts`
- `src/main/preload.ts` exports `ElectronApi` type used by the renderer
- Main process tsconfig: `module: node16` (required for yahoo-finance2 dynamic import)
- Renderer tsconfig: `module: ESNext` with `moduleResolution: bundler`
- CSS uses Tailwind v4 with `@import "tailwindcss"` — no tailwind.config.js needed

## Keyboard shortcuts
- `j`/`k` — navigate articles
- `o` — open in browser
- `s` — toggle star
- `r` — refresh feeds

## Commands
- `npm install` — install dependencies
- `npm run dev` — start dev server (builds main, then runs tsc watch + vite + electron concurrently)
- `npm run build` — production build
- `npm run dist` — build + package as .dmg
- `npm run typecheck` — type-check both main and renderer without emitting

## File layout
```
src/
  main/           # Electron main process
    index.ts      # App entry, window creation, CSP
    database.ts   # SQLite init and schema
    feeds.ts      # Feed/article CRUD and fetching
    stocks.ts     # Watchlist CRUD and Yahoo Finance
    ipc.ts        # IPC handler registration
    preload.ts    # contextBridge API
  renderer/       # React frontend
    main.tsx      # React entry
    App.tsx       # Root layout
    global.d.ts   # window.api types
    styles/       # Tailwind CSS
    hooks/        # React hooks (useIpc)
    components/
      common/     # Shared UI (Spinner)
      rss/        # RSS panel (Sidebar, ArticleList, ArticleView, RssPanel)
      stocks/     # Stock panel (StockPanel)
  shared/
    types.ts      # Types shared between main and renderer
```
