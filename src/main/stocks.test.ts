import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './test-setup';
import { initDatabase, closeDatabase } from './database';
import { addToWatchlist, removeFromWatchlist, getWatchlist } from './stocks';

describe('Stocks Logic', () => {
  beforeAll(() => {
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  it('should add a stock successfully', async () => {
    const symbol = 'AAPL';
    const item = await addToWatchlist(symbol);
    
    expect(item.symbol).toBe(symbol);
    expect(item.displayName).toBeDefined();
    
    const watchlist = getWatchlist();
    expect(watchlist.some(w => w.symbol === symbol)).toBe(true);
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
