import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import './test-setup';
import { initDatabase, closeDatabase, getDb } from './database';
import { addToWatchlist, removeFromWatchlist, getWatchlist, validateStock } from './stocks';

describe('Stocks Logic', () => {
  beforeAll(() => {
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM watchlist').run();
  });

  it('should validate a stock successfully', async () => {
    const valid = await validateStock('AAPL');
    expect(valid).toBe(true);
    
    const invalid = await validateStock('NONEXISTENT_TICKER_XYZ');
    expect(invalid).toBe(false);
  }, 10000);

  it('should add a stock successfully', async () => {
    const symbol = 'AAPL';
    const item = await addToWatchlist(symbol);
    
    expect(item.symbol).toBe(symbol);
    expect(item.displayName).toBeDefined();
    
    const watchlist = getWatchlist();
    expect(watchlist.some(w => w.symbol === symbol)).toBe(true);
  }, 10000);

  it('should still add a non-existent stock if requested directly', async () => {
    // Note: The UI now prevents this via validateStock, 
    // but the backend should handle it gracefully.
    const symbol = 'FAKE_TICKER';
    const item = await addToWatchlist(symbol);
    expect(item.symbol).toBe(symbol);
    expect(item.displayName).toBe(symbol); // Falls back to symbol
  }, 10000);

  it('should remove a stock successfully', async () => {
    const watchlistBefore = getWatchlist();
    const itemToDelete = watchlistBefore[0];
    if (itemToDelete) {
      removeFromWatchlist(itemToDelete.id);
      const watchlistAfter = getWatchlist();
      expect(watchlistAfter.some(w => w.id === itemToDelete.id)).toBe(false);
    }
  });
});
