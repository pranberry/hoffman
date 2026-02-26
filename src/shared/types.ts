/**
 * ── ARCHITECTURAL OVERVIEW: SHARED TYPES ──
 * This file serves as the Single Source of Truth for data structures used by both 
 * the Main process (Node/SQLite) and the Renderer process (React).
 * It also defines the "Contract" (IpcChannels) for Inter-Process Communication (IPC).
 */

/** RSS Folder structure for organizing feeds */
export interface Folder {
  id: number;
  name: string;
  position: number;
}

/** RSS Feed metadata */
export interface Feed {
  id: number;
  url: string;
  title: string;
  description: string;
  siteUrl: string;
  folderId: number | null;
  position: number;
  lastFetchedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

/** A single article from an RSS feed */
export interface Article {
  id: number;
  feedId: number;
  guid: string;
  title: string;
  link: string;
  author: string;
  summary: string;
  content: string;
  publishedAt: string;
  isRead: boolean;
  isStarred: boolean;
  fetchedAt: string;
}

/** Real-time stock price data (cached in memory/DB) */
export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  lastUpdated: string;
}

/** Detailed financial data for a specific stock */
export interface StockDetail {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayLow: number;
  dayHigh: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  marketCap: number;
  volume: number;
  avgVolume: number;
  // Financial metrics
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  targetMeanPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
}

/** A named group for organizing watchlist stocks */
export interface StockGroup {
  id: number;
  name: string;
  position: number;
}

/** User's personal stock watchlist entry */
export interface WatchlistItem {
  id: number;
  symbol: string;
  displayName: string;
  position: number;
  groupId: number | null;
  addedAt: string;
}

/**
 * ── IPC CHANNEL DEFINITIONS ──
 * This interface maps every valid string channel name to its expected function signature.
 * It ensures type safety when using 'window.api' in the renderer.
 */
export interface IpcChannels {
  // Folders management
  'folders:list': () => Folder[];
  'folders:create': (name: string) => Folder;
  'folders:rename': (id: number, name: string) => Folder;
  'folders:delete': (id: number) => void;
  'folders:reorder': (ids: number[]) => void;

  // Global app settings (stored in SQLite)
  'settings:get': (key: string) => string | null;
  'settings:set': (key: string, value: string) => void;
  'settings:list': () => Record<string, string>;

  // RSS Feed management
  'feeds:list': () => Feed[];
  'feeds:add': (url: string, folderId: number | null) => Feed;
  'feeds:remove': (id: number) => void;
  'feeds:rename': (id: number, title: string) => Feed;
  'feeds:refresh': (id?: number) => Article[];
  'feeds:move': (id: number, folderId: number | null) => void;
  'feeds:reorder': (ids: number[]) => void;

  // Article reading & state
  'articles:list': (feedId?: number, folderId?: number) => Article[];
  'articles:get': (id: number) => Article | null;
  'articles:markRead': (id: number, isRead: boolean) => void;
  'articles:markAllRead': (feedId?: number) => void;
  'articles:toggleStar': (id: number) => Article;
  'articles:starred': () => Article[];

  // Stock Market functionality
  'stocks:watchlist': () => WatchlistItem[];
  'stocks:add': (symbol: string) => WatchlistItem;
  'stocks:validate': (symbol: string) => boolean;
  'stocks:remove': (id: number) => void;
  'stocks:quotes': () => StockQuote[];
  'stocks:detail': (symbol: string) => StockDetail;
  'stocks:reorder': (ids: number[]) => void;
  'stocks:move': (stockId: number, groupId: number | null) => void;
  'stocks:groups:list': () => StockGroup[];
  'stocks:groups:create': (name: string) => StockGroup;
  'stocks:groups:rename': (id: number, name: string) => StockGroup;
  'stocks:groups:delete': (id: number) => void;
  'stocks:groups:reorder': (ids: number[]) => void;

  // Data Portability
  'backup:export': () => Promise<{ success: boolean; filePath?: string }>;
  'backup:import': () => Promise<{ success: boolean; count?: { feeds: number; stocks: number; folders: number } }>;
}
