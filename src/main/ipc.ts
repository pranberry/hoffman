import { ipcMain, shell } from 'electron';
import {
  listFolders, createFolder, renameFolder, deleteFolder,
  listFeeds, addFeed, removeFeed, renameFeed, updateFeedUrl, moveFeed,
  listArticles, getArticle, markArticleRead, markAllRead,
  toggleStar, listStarredArticles, refreshFeed, refreshAllFeeds,
} from './feeds';
import {
  getWatchlist, addToWatchlist, removeFromWatchlist,
  reorderWatchlist, fetchQuotes, fetchStockDetail,
} from './stocks';
import { getSetting, setSetting, listSettings } from './settings';
import { exportBackup, importBackup } from './backup';

export function registerIpcHandlers(): void {
  // ── Folders ──
  ipcMain.handle('folders:list', () => listFolders());
  ipcMain.handle('folders:create', (_e, name: string) => createFolder(name));
  ipcMain.handle('folders:rename', (_e, id: number, name: string) => renameFolder(id, name));
  ipcMain.handle('folders:delete', (_e, id: number) => deleteFolder(id));

  // ── Settings ──
  ipcMain.handle('settings:get', (_e, key: string) => getSetting(key));
  ipcMain.handle('settings:set', (_e, key: string, value: string) => setSetting(key, value));
  ipcMain.handle('settings:list', () => listSettings());

  // ── Feeds ──
  ipcMain.handle('feeds:list', () => listFeeds());
  ipcMain.handle('feeds:add', (_e, url: string, folderId: number | null) => addFeed(url, folderId));
  ipcMain.handle('feeds:remove', (_e, id: number) => removeFeed(id));
  ipcMain.handle('feeds:rename', (_e, id: number, title: string) => renameFeed(id, title));
  ipcMain.handle('feeds:updateUrl', (_e, id: number, url: string) => updateFeedUrl(id, url));
  ipcMain.handle('feeds:move', (_e, id: number, folderId: number | null) => moveFeed(id, folderId));
  ipcMain.handle('feeds:refresh', (_e, feedId?: number) => {
    if (feedId !== undefined) return refreshFeed(feedId);
    return refreshAllFeeds();
  });

  // ── Articles ──
  ipcMain.handle('articles:list', (_e, feedId?: number, folderId?: number) => listArticles(feedId, folderId));
  ipcMain.handle('articles:get', (_e, id: number) => getArticle(id));
  ipcMain.handle('articles:markRead', (_e, id: number, isRead: boolean) => markArticleRead(id, isRead));
  ipcMain.handle('articles:markAllRead', (_e, feedId?: number) => markAllRead(feedId));
  ipcMain.handle('articles:toggleStar', (_e, id: number) => toggleStar(id));
  ipcMain.handle('articles:starred', () => listStarredArticles());

  // ── Stocks ──
  ipcMain.handle('stocks:watchlist', () => getWatchlist());
  ipcMain.handle('stocks:add', (_e, symbol: string) => addToWatchlist(symbol));
  ipcMain.handle('stocks:remove', (_e, id: number) => removeFromWatchlist(id));
  ipcMain.handle('stocks:quotes', () => fetchQuotes());
  ipcMain.handle('stocks:detail', (_e, symbol: string) => fetchStockDetail(symbol));
  ipcMain.handle('stocks:reorder', (_e, ids: number[]) => reorderWatchlist(ids));

  // ── Backup ──
  ipcMain.handle('backup:export', () => exportBackup());
  ipcMain.handle('backup:import', () => importBackup());

  // ── Utilities ──
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    // Only allow http/https URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return shell.openExternal(url);
    }
    throw new Error('Only http/https URLs are allowed');
  });
}
