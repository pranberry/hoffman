import { getDb } from './database';
import type { WatchlistItem, StockQuote } from '../shared/types';

// yahoo-finance2 is ESM-only; use dynamic import for CJS main process
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _yf: any;
async function getYahooFinance() {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    _yf = mod.default;
  }
  return _yf;
}

function rowToWatchlistItem(row: Record<string, unknown>): WatchlistItem {
  return {
    id: row.id as number,
    symbol: row.symbol as string,
    displayName: row.display_name as string,
    position: row.position as number,
    addedAt: row.added_at as string,
  };
}

export function getWatchlist(): WatchlistItem[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM watchlist ORDER BY position ASC, id ASC').all() as Record<string, unknown>[];
  return rows.map(rowToWatchlistItem);
}

export async function addToWatchlist(symbol: string): Promise<WatchlistItem> {
  const db = getDb();
  const upper = symbol.toUpperCase().trim();

  // Validate by fetching a quote
  let name = upper;
  try {
    const yf = await getYahooFinance();
    const quote = await yf.quote(upper);
    name = quote.shortName || quote.longName || upper;
  } catch {
    // Use symbol as name if lookup fails — stock may still be valid
  }

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next FROM watchlist').get() as { next: number };
  const result = db.prepare('INSERT INTO watchlist (symbol, display_name, position) VALUES (?, ?, ?)').run(upper, name, maxPos.next);

  return rowToWatchlistItem(
    db.prepare('SELECT * FROM watchlist WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown>
  );
}

export function removeFromWatchlist(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(id);
}

export function reorderWatchlist(ids: number[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE watchlist SET position = ? WHERE id = ?');
  const updateAll = db.transaction((orderedIds: number[]) => {
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i]);
    }
  });
  updateAll(ids);
}

export async function fetchQuotes(): Promise<StockQuote[]> {
  const watchlist = getWatchlist();
  if (watchlist.length === 0) return [];

  const yf = await getYahooFinance();
  const symbols = watchlist.map(w => w.symbol);
  const quotes: StockQuote[] = [];

  // Fetch individually to handle partial failures gracefully
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const quote = await yf.quote(symbol);
      return {
        symbol,
        name: quote.shortName || quote.longName || symbol,
        price: quote.regularMarketPrice ?? 0,
        change: quote.regularMarketChange ?? 0,
        changePercent: quote.regularMarketChangePercent ?? 0,
        previousClose: quote.regularMarketPreviousClose ?? 0,
        lastUpdated: new Date().toISOString(),
      } satisfies StockQuote;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      quotes.push(result.value);
    }
  }

  return quotes;
}
