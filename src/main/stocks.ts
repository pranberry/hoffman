import { getDb } from './database';
import type { WatchlistItem, StockQuote, StockDetail } from '../shared/types';

// yahoo-finance2 is ESM-only; use dynamic import and instantiate with `new`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _yf: any;
async function getYahooFinance() {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    const YF = mod.default;
    // v3 exports a class that must be instantiated
    _yf = typeof YF === 'function' ? new YF({ suppressNotices: ['yahooSurvey'] }) : YF;
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

export async function validateStock(symbol: string): Promise<boolean> {
  if (!symbol.trim()) return false;
  try {
    const yf = await getYahooFinance();
    const quote = await yf.quote(symbol.toUpperCase().trim());
    return !!quote;
  } catch {
    return false;
  }
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

export async function fetchStockDetail(symbol: string): Promise<StockDetail> {
  const yf = await getYahooFinance();

  // Fetch quote + summary in parallel
  const [quote, summary] = await Promise.all([
    yf.quote(symbol),
    yf.quoteSummary(symbol, { modules: ['summaryDetail', 'financialData'] }).catch(() => null),
  ]);

  const sd = summary?.summaryDetail;
  const fd = summary?.financialData;

  return {
    symbol,
    name: quote.shortName || quote.longName || symbol,
    price: quote.regularMarketPrice ?? 0,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    previousClose: quote.regularMarketPreviousClose ?? 0,
    open: quote.regularMarketOpen ?? sd?.regularMarketOpen ?? 0,
    dayLow: quote.regularMarketDayLow ?? sd?.regularMarketDayLow ?? 0,
    dayHigh: quote.regularMarketDayHigh ?? sd?.regularMarketDayHigh ?? 0,
    fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? sd?.fiftyTwoWeekLow ?? 0,
    fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? sd?.fiftyTwoWeekHigh ?? 0,
    marketCap: quote.marketCap ?? 0,
    volume: quote.regularMarketVolume ?? sd?.volume ?? 0,
    avgVolume: quote.averageDailyVolume3Month ?? sd?.averageVolume ?? 0,
    peRatio: quote.trailingPE ?? sd?.trailingPE ?? null,
    eps: quote.epsTrailingTwelveMonths ?? null,
    dividendYield: sd?.dividendYield ?? null,
    targetMeanPrice: fd?.targetMeanPrice ?? null,
    recommendationKey: fd?.recommendationKey ?? null,
    numberOfAnalystOpinions: fd?.numberOfAnalystOpinions ?? null,
  };
}
