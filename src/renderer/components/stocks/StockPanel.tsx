import React, { useState, useCallback, useEffect } from 'react';
import type { WatchlistItem, StockQuote, StockDetail } from '../../../shared/types';
import { Spinner } from '../common/Spinner';

function formatNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return '--';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatLargeNum(n: number | null | undefined): string {
  if (n == null || isNaN(n) || n === 0) return '--';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800/50">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export function StockPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadWatchlist = useCallback(async () => {
    const items = await window.api.stocks.watchlist();
    setWatchlist(items);
  }, []);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const q = await window.api.stocks.quotes();
      setQuotes(q);
    } catch (err) {
      console.error('Failed to fetch quotes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadWatchlist().then(loadQuotes);
  }, [loadWatchlist, loadQuotes]);

  // Auto-refresh quotes every 60 seconds
  useEffect(() => {
    const interval = setInterval(loadQuotes, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadQuotes]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    setError(null);
    try {
      await window.api.stocks.add(symbol.trim());
      setSymbol('');
      setShowAdd(false);
      await loadWatchlist();
      await loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add symbol');
    }
  }, [symbol, loadWatchlist, loadQuotes]);

  const handleRemove = useCallback(async (id: number) => {
    const item = watchlist.find(w => w.id === id);
    await window.api.stocks.remove(id);
    if (item && selectedSymbol === item.symbol) {
      setSelectedSymbol(null);
      setDetail(null);
    }
    await loadWatchlist();
    setQuotes(prev => prev.filter(q => {
      return item ? q.symbol !== item.symbol : true;
    }));
  }, [watchlist, loadWatchlist, selectedSymbol]);

  const handleSelectStock = useCallback(async (sym: string) => {
    if (selectedSymbol === sym) {
      // Toggle off
      setSelectedSymbol(null);
      setDetail(null);
      return;
    }
    setSelectedSymbol(sym);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await window.api.stocks.detail(sym);
      setDetail(d);
    } catch (err) {
      console.error('Failed to load detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedSymbol]);

  const getQuote = (sym: string) => quotes.find(q => q.symbol === sym);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="titlebar-drag h-12 flex items-end px-4 pb-1 justify-between flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider titlebar-no-drag flex items-center gap-2">
          Stocks {loading && <Spinner size="sm" />}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {watchlist.length === 0 && !showAdd && (
          <p className="text-xs text-gray-400 text-center py-4">
            No stocks tracked yet.
          </p>
        )}

        {watchlist.map(item => {
          const quote = getQuote(item.symbol);
          const isPositive = quote && quote.change >= 0;
          const isSelected = selectedSymbol === item.symbol;

          return (
            <div key={item.id}>
              <button
                onClick={() => handleSelectStock(item.symbol)}
                className={`w-full flex items-center justify-between p-2 rounded group transition-colors text-left ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.symbol}</div>
                  <div className="text-[11px] text-gray-400 truncate">{item.displayName}</div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  {quote ? (
                    <>
                      <div className="text-sm font-mono">${formatNum(quote.price)}</div>
                      <div className={`text-[11px] font-mono ${
                        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {isPositive ? '+' : ''}{formatNum(quote.change)} ({isPositive ? '+' : ''}{formatNum(quote.changePercent)}%)
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">--</div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                  className="opacity-0 group-hover:opacity-100 ml-1.5 text-gray-400 hover:text-red-500 text-xs flex-shrink-0"
                  title="Remove"
                >
                  x
                </button>
              </button>

              {/* Detail panel — inline below the selected stock */}
              {isSelected && (
                <div className="mx-1 mb-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-[11px]">
                  {detailLoading ? (
                    <div className="flex justify-center py-3"><Spinner size="sm" /></div>
                  ) : detail ? (
                    <div className="space-y-0">
                      <div className="text-sm font-medium mb-2">{detail.name}</div>

                      <DetailRow label="Open" value={`$${formatNum(detail.open)}`} />
                      <DetailRow label="Day Range" value={`$${formatNum(detail.dayLow)} - $${formatNum(detail.dayHigh)}`} />
                      <DetailRow label="52W Range" value={`$${formatNum(detail.fiftyTwoWeekLow)} - $${formatNum(detail.fiftyTwoWeekHigh)}`} />
                      <DetailRow label="Volume" value={formatLargeNum(detail.volume)} />
                      <DetailRow label="Avg Volume" value={formatLargeNum(detail.avgVolume)} />
                      <DetailRow label="Market Cap" value={formatLargeNum(detail.marketCap)} />

                      {detail.peRatio != null && <DetailRow label="P/E Ratio" value={formatNum(detail.peRatio)} />}
                      {detail.eps != null && <DetailRow label="EPS" value={`$${formatNum(detail.eps)}`} />}
                      {detail.dividendYield != null && <DetailRow label="Div Yield" value={`${formatNum(detail.dividendYield * 100)}%`} />}

                      {(detail.targetMeanPrice != null || detail.recommendationKey != null) && (
                        <>
                          <div className="mt-2 pt-1 border-t border-gray-200 dark:border-gray-700 text-[10px] uppercase text-gray-400 font-medium">Analyst</div>
                          {detail.targetMeanPrice != null && <DetailRow label="Target Price" value={`$${formatNum(detail.targetMeanPrice)}`} />}
                          {detail.recommendationKey != null && <DetailRow label="Rating" value={detail.recommendationKey.toUpperCase()} />}
                          {detail.numberOfAnalystOpinions != null && <DetailRow label="# Analysts" value={String(detail.numberOfAnalystOpinions)} />}
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-2">Could not load details</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        {showAdd ? (
          <form onSubmit={handleAdd} className="space-y-2">
            <input
              type="text"
              placeholder="Symbol (e.g. AAPL)..."
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-1">
              <button type="submit" className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
              <button type="button" onClick={() => { setShowAdd(false); setError(null); }} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => setShowAdd(true)}
              className="flex-1 px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              + Add Stock
            </button>
            <button
              onClick={loadQuotes}
              className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              title="Refresh quotes"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
