# Hoffman Reader - Project Memory

## Architecture
- Electron app: main process (Node/SQLite) + renderer (React/Tailwind)
- IPC bridge via preload.ts → `window.api` in renderer
- Types shared in `src/shared/types.ts` (source of truth for IPC contracts)
- DB: SQLite via better-sqlite3, WAL mode, in `app.getPath('userData')/hoffman-reader.db`

## Key Files
- `src/main/database.ts` - schema + migrations
- `src/main/ipc.ts` - IPC handler registration
- `src/main/preload.ts` - contextBridge exposure (`window.api`)
- `src/main/stocks.ts` - stock/watchlist/group backend logic
- `src/main/feeds.ts` - RSS feed logic
- `src/renderer/components/stocks/StockPanel.tsx` - full stock UI with D&D + groups
- `src/renderer/components/rss/Sidebar.tsx` - feed sidebar with D&D

## Stock Groups Feature (added 2026-02)
- `stock_groups` table: id, name, position
- `watchlist.group_id` FK to stock_groups (added via migration)
- New IPC channels: `stocks:groups:list/create/rename/delete/reorder`, `stocks:move`
- D&D in StockPanel: top 30% = insert above, bottom 30% = insert below, middle = group
- Drop stock on stock (center) → creates group or joins existing group
- Drop stock on group header → moves to that group
- Drop group on group → reorders groups
- Group rename: double-click the group title
- Groups collapse independently; in narrow panel (<160px), headers are hidden

## SwipeToDelete (added 2026-03)
- Component: `src/renderer/components/common/SwipeToDelete.tsx`
- Uses `wheel` events (non-passive DOM listener) — never conflicts with HTML5 drag & drop
- Module-level `lastDeletedAt` timestamp shared across all instances prevents chain-deletes from one trackpad gesture
- Key constants: THRESHOLD=180px, DAMPEN=0.55, RESET_DELAY=400ms, DELETE_COOLDOWN=900ms
- Applied inside DraggableFeed and folder header (Sidebar.tsx), StockRow button and GroupHeader content (StockPanel.tsx)
- Drop indicators kept OUTSIDE SwipeToDelete wrapper (so they aren't clipped by overflow-hidden)

## Patterns
- Migrations: check `PRAGMA table_info(table)` then `ALTER TABLE ADD COLUMN`
- Can't use FK constraints in `ALTER TABLE ADD COLUMN` in SQLite — add column only
- Drag types: `application/x-stock-id`, `application/x-group-id`, `application/x-feed-id`, `application/x-folder-id`
- `e.currentTarget.contains(e.relatedTarget)` guard in onDragLeave prevents child-element flicker
- When a child element is also draggable inside a draggable parent, `e.stopPropagation()` in the child's `onDragStart` prevents both starting at once
- New stock group auto-enters rename mode after creation (`setRenamingGroupId`)
- Folder reordering (added 2026-02): `reorderFolders` in feeds.ts, `folders:reorder` IPC, `handleFolderDrop` in Sidebar.tsx — folders are draggable with above/below line indicators, feed drag still works (uses `application/x-feed-id` check)
