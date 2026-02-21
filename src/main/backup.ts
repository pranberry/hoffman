import { dialog } from 'electron';
import fs from 'fs/promises';
import { getDb } from './database';
import { listFolders, createFolder, listFeeds } from './feeds';
import { getWatchlist } from './stocks';

interface BackupData {
  version: number;
  feeds: Array<{
    url: string;
    title?: string;
    folder?: string;
  }>;
  stocks: Array<{
    symbol: string;
    name?: string;
  }>;
}

export async function exportBackup() {
  const db = getDb();
  const folders = listFolders();
  const feeds = listFeeds();
  const watchlist = getWatchlist();

  const data: BackupData = {
    version: 1,
    feeds: feeds.map(f => {
      const folder = folders.find(fold => fold.id === f.folderId);
      return {
        url: f.url,
        title: f.title,
        folder: folder?.name,
      };
    }),
    stocks: watchlist.map(w => ({
      symbol: w.symbol,
      name: w.displayName,
    })),
  };

  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Settings',
    defaultPath: 'private-news-settings.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (canceled || !filePath) return { success: false };

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return { success: true, filePath };
}

export async function importBackup() {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    title: 'Import Settings',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) return { success: false };

  const content = await fs.readFile(filePaths[0], 'utf8');
  const data = JSON.parse(content) as BackupData;

  if (!data.feeds && !data.stocks) {
    throw new Error('Invalid backup file: no feeds or stocks found');
  }

  const db = getDb();
  let feedsAdded = 0;
  let stocksAdded = 0;
  let foldersCreated = 0;

  // Use a transaction for speed and consistency
  db.transaction(() => {
    // Cache folders to avoid redundant lookups
    const folderMap = new Map<string, number>();
    listFolders().forEach(f => folderMap.set(f.name.toLowerCase(), f.id));

    // Import Stocks
    if (data.stocks) {
      const stmt = db.prepare('INSERT OR IGNORE INTO watchlist (symbol, display_name, position) VALUES (?, ?, ?)');
      const maxPosStmt = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next FROM watchlist');
      
      for (const s of data.stocks) {
        const symbol = typeof s === 'string' ? s : s.symbol;
        const name = typeof s === 'string' ? symbol : (s.name || symbol);
        const nextPos = (maxPosStmt.get() as { next: number }).next;
        const res = stmt.run(symbol.toUpperCase(), name, nextPos);
        if (res.changes > 0) stocksAdded++;
      }
    }

    // Import Feeds
    if (data.feeds) {
      const stmt = db.prepare('INSERT OR IGNORE INTO feeds (url, title, folder_id) VALUES (?, ?, ?)');
      
      for (const f of data.feeds) {
        let folderId: number | null = null;
        if (f.folder) {
          const lowerFolder = f.folder.toLowerCase();
          if (folderMap.has(lowerFolder)) {
            folderId = folderMap.get(lowerFolder)!;
          } else {
            const newFolder = createFolder(f.folder);
            folderId = newFolder.id;
            folderMap.set(lowerFolder, folderId);
            foldersCreated++;
          }
        }

        const res = stmt.run(f.url, f.title || f.url, folderId);
        if (res.changes > 0) feedsAdded++;
      }
    }
  })();

  return { 
    success: true, 
    count: { 
      feeds: feedsAdded, 
      stocks: stocksAdded, 
      folders: foldersCreated 
    } 
  };
}
