import { vi } from 'vitest';

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

// State for mock DB
let feeds = [{ id: 1, url: 'https://www.aier.org/feed/', title: 'AIER' }];
let watchlist = [{ id: 1, symbol: 'AAPL', display_name: 'Apple' }];

// Better-sqlite3 mock
const mockDb = {
  pragma: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn().mockImplementation((sql) => {
    return {
      all: vi.fn().mockImplementation(() => {
        if (sql.includes('FROM feeds')) return feeds;
        if (sql.includes('FROM watchlist')) return watchlist;
        return [];
      }),
      get: vi.fn().mockImplementation(() => {
        if (sql.includes('MAX(position)')) return { next: 1 };
        if (sql.includes('FROM feeds')) return feeds[0];
        if (sql.includes('FROM watchlist')) return watchlist[0];
        return { id: 1 };
      }),
      run: vi.fn().mockImplementation((...params) => {
        if (sql.includes('DELETE FROM feeds')) {
          feeds = feeds.filter(f => f.id !== params[0]);
        }
        if (sql.includes('DELETE FROM watchlist')) {
          watchlist = watchlist.filter(w => w.id !== params[0]);
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
