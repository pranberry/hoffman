import { vi } from 'vitest';

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

// State for mock DB
let folders: any[] = [];
let feeds: any[] = [
  { id: 1, url: 'https://www.aier.org/feed/', title: 'AIER', folder_id: null, last_fetched_at: null, error_message: null, created_at: new Date().toISOString() }
];
let watchlist: any[] = [
  { id: 1, symbol: 'AAPL', display_name: 'Apple', position: 0, added_at: new Date().toISOString() }
];

// Better-sqlite3 mock
const mockDb = {
  pragma: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn().mockImplementation((sql) => {
    return {
      all: vi.fn().mockImplementation(() => {
        if (sql.includes('FROM folders')) return folders;
        if (sql.includes('FROM feeds')) return feeds;
        if (sql.includes('FROM watchlist')) return watchlist;
        return [];
      }),
      get: vi.fn().mockImplementation((...params) => {
        if (sql.includes('MAX(position)')) {
          const list = sql.includes('watchlist') ? watchlist : folders;
          const max = list.reduce((acc, curr) => Math.max(acc, curr.position ?? 0), -1);
          return { next: max + 1 };
        }
        if (sql.includes('FROM feeds WHERE id = ?')) return feeds.find(f => f.id === params[0]);
        if (sql.includes('FROM feeds WHERE url = ?')) return feeds.find(f => f.url === params[0]);
        if (sql.includes('FROM watchlist WHERE id = ?')) return watchlist.find(w => w.id === params[0]);
        if (sql.includes('FROM watchlist WHERE symbol = ?')) return watchlist.find(w => w.symbol === params[0]);
        
        // Default fallbacks for common queries
        if (sql.includes('FROM feeds')) return feeds[0];
        if (sql.includes('FROM watchlist')) return watchlist[0];
        return null;
      }),
      run: vi.fn().mockImplementation((...params) => {
        if (sql.startsWith('INSERT INTO feeds')) {
          const newFeed = {
            id: feeds.length + 1,
            url: params[0],
            title: params[1] || '',
            folder_id: params[2] || null,
            created_at: new Date().toISOString()
          };
          feeds.push(newFeed);
          return { lastInsertRowid: newFeed.id, changes: 1 };
        }
        if (sql.startsWith('INSERT INTO watchlist')) {
          const newItem = {
            id: watchlist.length + 1,
            symbol: params[0],
            display_name: params[1],
            position: params[2],
            added_at: new Date().toISOString()
          };
          watchlist.push(newItem);
          return { lastInsertRowid: newItem.id, changes: 1 };
        }
        if (sql.includes('DELETE FROM feeds')) {
          if (sql.includes('WHERE id = ?')) {
            feeds = feeds.filter(f => f.id !== params[0]);
          } else {
            feeds = [];
          }
        }
        if (sql.includes('DELETE FROM watchlist')) {
          if (sql.includes('WHERE id = ?')) {
            watchlist = watchlist.filter(w => w.id !== params[0]);
          } else {
            watchlist = [];
          }
        }
        return { lastInsertRowid: 1, changes: 1 };
      }),
    };
  }),
  transaction: vi.fn((fn) => {
    return (...args: any[]) => fn(...args);
  }),
  close: vi.fn(),
};

vi.mock('better-sqlite3', () => {
  return {
    default: function() {
      return mockDb;
    },
  };
});
