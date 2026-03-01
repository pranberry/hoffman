# Hoffman Reader — Architecture

A privacy-first Electron desktop app: an RSS reader on the left, a stock watchlist on the right. No cloud, no telemetry, no accounts. Everything lives in a local SQLite database.

---

## Process Model

Electron runs two OS-level processes that communicate through a narrow, typed bridge.

```
┌────────────────────────────────────────────────────────────────────┐
│  Main Process  (Node.js, trusted)                                  │
│                                                                    │
│  index.ts ──► ipc.ts ──► feeds.ts / stocks.ts / settings.ts       │
│                    │                                               │
│                    └──► database.ts  (better-sqlite3 / SQLite)     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  ipcMain.handle / ipcRenderer.invoke
                               │  (structured-clone serialised data)
┌──────────────────────────────┴─────────────────────────────────────┐
│  Preload Script  (bridge, runs before Renderer)                    │
│  preload.ts: exposes window.api via contextBridge                  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  window.api.*
┌──────────────────────────────┴─────────────────────────────────────┐
│  Renderer Process  (React/Vite, sandboxed)                         │
│                                                                    │
│  main.tsx → App.tsx → RssPanel  +  StockPanel                      │
│                           │               │                        │
│                      Sidebar            StockRow                   │
│                      ArticleList        GroupHeader                │
│                      ArticleView        SwipeToDelete              │
│                      SettingsPanel      Spinner                    │
└────────────────────────────────────────────────────────────────────┘
```

The Renderer has **no access to Node.js**. `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. The only way it touches anything outside itself is via `window.api`, which is the preload's exported object.

---

## Source Files

### Main Process — `src/main/`

#### `index.ts`
The Electron lifecycle. Creates the `BrowserWindow` (1200×800, macOS-styled hidden title bar), calls `initDatabase()` and `registerIpcHandlers()`, then loads the app. Sets a strict Content Security Policy:
- **Production**: `default-src 'self'` only
- **Development**: also allows Vite's dev server (`localhost:5173`, `ws://`)

Locks down security: blocks all navigation away from the app origin, blocks `window.open()`. On quit, closes the DB cleanly.

#### `database.ts`
Opens (or creates) the SQLite file at `{userData}/hoffman-reader.db`. Enables WAL mode and foreign key enforcement. Runs `createTables()` then `runMigrations()` on every start — migrations check `PRAGMA table_info` and `ALTER TABLE ADD COLUMN` when a column is missing (e.g. `position`, `group_id`). Exports `getDb()`, `initDatabase()`, `closeDatabase()`.

#### `preload.ts`
The only way data moves between processes. Exports `window.api` with six namespaces:

```
window.api
  .folders  — list / create / rename / delete / reorder
  .feeds     — list / add / remove / rename / updateUrl / move / reorder / refresh
  .articles  — list / get / markRead / markAllRead / toggleStar / starred
  .stocks    — watchlist / add / validate / remove / quotes / detail / reorder / move
                .groups: list / create / rename / delete / reorder
  .settings  — get / set / list
  .backup    — export / import
  .shell     — openExternal  (http/https only)
```

Every method is just a typed wrapper around `ipcRenderer.invoke(channel, ...args)`.

#### `ipc.ts`
Registers all `ipcMain.handle(channel, fn)` calls. No business logic here — it delegates entirely to `feeds.ts`, `stocks.ts`, `settings.ts`, `backup.ts`. Also validates `shell:openExternal` (only permits `http:`/`https:` URLs).

#### `feeds.ts`
The largest module (~450 lines). Handles all RSS/Atom logic:

- **Fetch & parse**: HTTP GET with a browser `User-Agent` (helps bypass bot rejection), parsed by `fast-xml-parser`. Detects RSS 2.0 (`<channel>`) vs Atom (`<feed>`) and normalises both to the same article shape. Handles CDATA, `#text` objects, `<link rel="alternate">`, and multiple date formats.
- **Insert**: Bulk `INSERT OR IGNORE INTO articles` wrapped in a SQLite transaction, so adding 200 articles from a new feed is a single commit.
- **CRUD**: Full create/read/update/delete for folders, feeds, and articles. `reorderFolders` and `reorderFeeds` do a transaction of per-row `UPDATE … SET position = ?` calls.
- **Refresh**: `refreshAllFeeds` fires all feed fetches in parallel (`Promise.all`), catches errors per feed and stores them in `error_message`, so one broken feed doesn't stop the rest.

#### `stocks.ts`
~200 lines. Integrates with Yahoo Finance via `yahoo-finance2` (ESM-only, so it's loaded with a dynamic `import()` to avoid CJS/ESM conflicts). Provides:

- **Watchlist CRUD + groups CRUD**: Standard SQLite operations.
- `fetchQuotes()`: Fetches live prices for all symbols; individual failures are swallowed so one dead ticker doesn't blank the whole panel.
- `fetchStockDetail(symbol)`: Fires three Yahoo fields in parallel (`quoteSummary` with `summaryDetail` + `financialData` modules) and merges them.
- `validateStock(symbol)`: Quick quote call to check the symbol exists before adding.

#### `settings.ts`
22 lines. A simple key-value store on the `settings` table — `getSetting`, `setSetting`, `listSettings`. The only persisted setting right now is `refresh_interval` (seconds).

#### `backup.ts`
Export: reads all folders, feeds, and watchlist items; serialises to JSON `{ version, feeds, stocks }`; shows a native save dialog. Import: shows an open dialog, parses the JSON, and replays each item as `INSERT OR IGNORE` inside a transaction. Idempotent — re-importing the same file is safe.

---

### Renderer Process — `src/renderer/`

#### `main.tsx`
Seven lines. Creates the React root and renders `<App />` into `#root`.

#### `App.tsx`
Root layout. Owns:
- The resizable stock panel width (via `useResizable`, persisted to `localStorage`)
- Three boolean toggles surfaced via props to children: `showAddStock`, `showAddFeed`, `showAddFolder`
- Global keyboard shortcuts (`Cmd/Ctrl` + modifier):
  - `Shift+T` — toggle add stock
  - `Shift+F` — toggle add feed
  - `Shift+D` — toggle add folder
  - `Shift+S` — star current article
- Responsive visibility: hides the stock panel if `window.innerWidth < 400`

Renders: `<RssPanel>` (fills remaining space) + a drag handle + `<StockPanel>` (fixed width on the right).

#### `components/rss/RssPanel.tsx`
The main RSS brain (~340 lines). Owns all RSS state: folders, feeds, articles, selections, auto-refresh. Handles every mutation (add/remove/move/rename/reorder for both feeds and folders). Sets up a `setInterval` auto-refresh based on the `refresh_interval` setting. Manages three resizable sub-panels with `useResizable`. Passes everything down as props — no context.

#### `components/rss/Sidebar.tsx`
Renders the feed/folder tree. Features:
- "All Articles" and "Starred" quick selectors at the top
- Folder rows that are draggable for reorder; they're also drop targets for feeds (move to folder) and other folders (reorder)
- Feed rows (`DraggableFeed`) that are draggable; drop on another feed to reorder, drop on a folder header to move
- `EditableFeedName`: double-click to rename inline; right-click to edit the URL inline
- `SwipeToDelete` wraps both feed rows and folder headers
- Add Feed / Add Folder forms at the bottom; Refresh and Settings buttons

Drag type tokens: `application/x-feed-id`, `application/x-feed-folder-id`, `application/x-folder-id`.

#### `components/rss/ArticleList.tsx`
A scrollable list of articles (~75 lines). Shows title (3-line clamp), author, relative time (`timeAgo()`), and a star indicator. Marks selected vs read with opacity/colour changes.

#### `components/rss/ArticleView.tsx`
Full article display. Content is rendered via `dangerouslySetInnerHTML` but always passed through `DOMPurify.sanitize()` first (strips scripts, event handlers, iframes). Detects "truncated feed" articles (content shorter than 200 chars, or equal to the summary) and prompts opening in the browser. Has a star toggle and an open-in-browser button.

#### `components/stocks/StockPanel.tsx`
The whole stock UI (~816 lines). Owns watchlist, groups, quotes, and selection state. Refreshes quotes every 60 seconds via `setInterval`. Symbol input is validated with a 400ms debounce. Collapses to a narrow icon-list layout when `width < 160px`, with a popover for detail in that mode.

Contains:
- **`StockRow`**: Quote display. Expands inline to show `StockDetailContent` when selected. Draggable for reorder/group operations.
- **`GroupHeader`**: Collapsible, double-click to rename inline, draggable for group reorder.
- **`StockDetailContent`**: Table of open, ranges, volume, market cap, P/E, EPS, dividend yield, analyst sentiment. Links to Yahoo Finance and FinViz (FinViz only for US equities — filtered by symbol pattern).
- **`TickerLegend`**: Cheat-sheet for bond/commodity/crypto/currency symbols shown in the add-stock form.

Drag type tokens: `application/x-stock-id`, `application/x-group-id`.

Drop zone logic for stocks:
- Top 30% of row → insert **above**
- Bottom 30% → insert **below**
- Middle 40% → **join/create group** (two ungrouped stocks dropped center → new group auto-created and enters rename mode)

#### `components/common/SettingsPanel.tsx`
A modal dialog for refresh interval (dropdown, 60s–daily), and Export/Import backup buttons. Saving the interval calls `settings:set` then reloads the page to re-read the interval.

#### `components/common/SwipeToDelete.tsx`
A wrapper component that detects horizontal trackpad or mouse scroll-wheel swipes using `wheel` events (non-passive DOM listener). Uses `wheel` specifically so it doesn't conflict with HTML5 drag-and-drop. Normalises `deltaX` across `deltaMode` values (pixel / line / page). Dampens accumulation (×0.55) and requires 180px of sustained rightward motion before committing. Reveals a red "Delete" background as you swipe, then slides the row off-screen and calls `onDelete`.

#### `components/common/Spinner.tsx`
A rotating SVG arc. Two sizes: `sm` (16px) and `md` (24px).

#### `hooks/useResizable.ts`
Tracks a `mousedown` on a drag-handle element, then listens to `mousemove`/`mouseup` on the window to resize. Clamps to `minWidth`/`maxWidth`. Optionally persists width to `localStorage` by key. Supports an `invert` flag for handles that resize left-to-right vs right-to-left.

#### `hooks/useIpc.ts`
Two generic hooks:
- **`useIpcQuery<T>(fn, deps)`** — calls an async function on mount (and when deps change), returns `{ data, loading, error, refetch }`.
- **`useIpcMutation<TArgs, TResult>(fn)`** — returns a `mutate()` function + `loading` state. Throws on failure.

These are utility hooks but most components call `window.api.*` directly for clarity.

#### `global.d.ts`
Extends the global `Window` interface with `api: ElectronApi` so TypeScript knows the full shape of `window.api` throughout the renderer.

---

## Database Schema

```
folders
  id        INTEGER PK
  name      TEXT
  position  INTEGER

feeds
  id              INTEGER PK
  url             TEXT UNIQUE
  title           TEXT
  description     TEXT
  site_url        TEXT
  folder_id       INTEGER → folders(id) ON DELETE SET NULL
  position        INTEGER
  last_fetched_at TEXT
  error_message   TEXT
  created_at      TEXT

articles
  id           INTEGER PK
  feed_id      INTEGER → feeds(id) ON DELETE CASCADE
  guid         TEXT                     ← unique per feed
  title        TEXT
  link         TEXT
  author       TEXT
  summary      TEXT
  content      TEXT
  published_at TEXT
  is_read      INTEGER  (0/1)
  is_starred   INTEGER  (0/1)
  fetched_at   TEXT
  UNIQUE(feed_id, guid)

stock_groups
  id        INTEGER PK
  name      TEXT
  position  INTEGER

watchlist
  id           INTEGER PK
  symbol       TEXT UNIQUE
  display_name TEXT
  position     INTEGER
  group_id     INTEGER → stock_groups(id) ON DELETE SET NULL
  added_at     TEXT

settings
  key    TEXT PK
  value  TEXT
```

Indexes on `articles`: `feed_id`, `published_at`, `is_read`, `is_starred`. Indexes on `feeds`: `folder_id`.

---

## IPC Channels (full list)

| Channel | Args → Return |
|---|---|
| `folders:list` | `() → Folder[]` |
| `folders:create` | `(name) → Folder` |
| `folders:rename` | `(id, name) → Folder` |
| `folders:delete` | `(id) → void` |
| `folders:reorder` | `(ids[]) → void` |
| `settings:get` | `(key) → string \| null` |
| `settings:set` | `(key, value) → void` |
| `settings:list` | `() → Record<string,string>` |
| `feeds:list` | `() → Feed[]` |
| `feeds:add` | `(url, folderId?) → Feed` |
| `feeds:remove` | `(id) → void` |
| `feeds:rename` | `(id, title) → Feed` |
| `feeds:updateUrl` | `(id, url) → Feed` |
| `feeds:move` | `(id, folderId?) → void` |
| `feeds:reorder` | `(ids[]) → void` |
| `feeds:refresh` | `(id?) → Article[]` |
| `articles:list` | `(feedId?, folderId?) → Article[]` |
| `articles:get` | `(id) → Article \| null` |
| `articles:markRead` | `(id, isRead) → void` |
| `articles:markAllRead` | `(feedId?) → void` |
| `articles:toggleStar` | `(id) → Article` |
| `articles:starred` | `() → Article[]` |
| `stocks:watchlist` | `() → WatchlistItem[]` |
| `stocks:add` | `(symbol) → WatchlistItem` |
| `stocks:validate` | `(symbol) → boolean` |
| `stocks:remove` | `(id) → void` |
| `stocks:quotes` | `() → StockQuote[]` |
| `stocks:detail` | `(symbol) → StockDetail` |
| `stocks:reorder` | `(ids[]) → void` |
| `stocks:move` | `(stockId, groupId?) → void` |
| `stocks:groups:list` | `() → StockGroup[]` |
| `stocks:groups:create` | `(name) → StockGroup` |
| `stocks:groups:rename` | `(id, name) → StockGroup` |
| `stocks:groups:delete` | `(id) → void` |
| `stocks:groups:reorder` | `(ids[]) → void` |
| `backup:export` | `() → { success, filePath? }` |
| `backup:import` | `() → { success, count? }` |
| `shell:openExternal` | `(url) → void` |

---

## Security Layers

| Layer | Mechanism |
|---|---|
| Process isolation | Renderer has no Node access (`sandbox: true`, `nodeIntegration: false`) |
| Context isolation | Renderer can't reach preload scope; only `window.api` is exposed |
| CSP | Blocks inline scripts, eval, external scripts in production |
| Navigation lock | `will-navigate` event blocked; `window.open` blocked |
| Feed content | `DOMPurify.sanitize()` before rendering any HTML |
| External URLs | `shell:openExternal` only allows `http:`/`https:` |
| SQL | All queries use prepared statement placeholders — no string concatenation |

---

## Key Technical Choices

| Choice | Why |
|---|---|
| `better-sqlite3` (sync API) | Main process IPC handlers are already async; sync DB calls are simpler and faster for single-writer SQLite |
| `fast-xml-parser` | Replaced dead `rss-parser`; handles RSS 2.0 + Atom; configurable array normalisation |
| `yahoo-finance2` as dynamic import | ESM-only package; dynamic `import()` lets the CJS-compiled main process load it |
| `wheel` events for swipe-to-delete | Completely separate from the HTML5 drag API — no gesture conflicts |
| No global state manager | Props + callbacks; the component tree is shallow enough that prop-drilling isn't painful |
| WAL mode | Concurrent reads don't block writes; important because quotes refresh on a timer while the user is interacting |
