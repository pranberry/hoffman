// ── Shared types used by both main and renderer processes ──

export interface Folder {
  id: number;
  name: string;
  position: number;
}

export interface Feed {
  id: number;
  url: string;
  title: string;
  description: string;
  siteUrl: string;
  folderId: number | null;
  lastFetchedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

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

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  lastUpdated: string;
}

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
  // Financial data
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  targetMeanPrice: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  displayName: string;
  position: number;
  addedAt: string;
}

// ── IPC Channel definitions ──

export interface IpcChannels {
  // Folders
  'folders:list': () => Folder[];
  'folders:create': (name: string) => Folder;
  'folders:rename': (id: number, name: string) => Folder;
  'folders:delete': (id: number) => void;

  // Settings
  'settings:get': (key: string) => string | null;
  'settings:set': (key: string, value: string) => void;
  'settings:list': () => Record<string, string>;

  // Feeds
  'feeds:list': () => Feed[];
  'feeds:add': (url: string, folderId: number | null) => Feed;
  'feeds:remove': (id: number) => void;
  'feeds:rename': (id: number, title: string) => Feed;
  'feeds:refresh': (id?: number) => Article[];
  'feeds:move': (id: number, folderId: number | null) => void;

  // Articles
  'articles:list': (feedId?: number, folderId?: number) => Article[];
  'articles:get': (id: number) => Article | null;
  'articles:markRead': (id: number, isRead: boolean) => void;
  'articles:markAllRead': (feedId?: number) => void;
  'articles:toggleStar': (id: number) => Article;
  'articles:starred': () => Article[];

  // Stocks
  'stocks:watchlist': () => WatchlistItem[];
  'stocks:add': (symbol: string) => WatchlistItem;
  'stocks:remove': (id: number) => void;
  'stocks:quotes': () => StockQuote[];
  'stocks:detail': (symbol: string) => StockDetail;
  'stocks:reorder': (ids: number[]) => void;

  // Backup & Restore
  'backup:export': () => Promise<{ success: boolean; filePath?: string }>;
  'backup:import': () => Promise<{ success: boolean; count?: { feeds: number; stocks: number; folders: number } }>;
}
