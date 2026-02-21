import React, { useState, useCallback, useEffect } from 'react';
import type { WatchlistItem, StockQuote } from '../../../shared/types';
import { Spinner } from '../common/Spinner';

export function StockPanel() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadWatchlist = useCallback(async () => {
    const items = await window.api.stocks.watchlist();
    setWatchlist(items);
  }, []);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const q = await window.api.stocks.quotes();
      setQuotes(q);
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
    await window.api.stocks.remove(id);
    await loadWatchlist();
    setQuotes(prev => prev.filter(q => {
      const item = watchlist.find(w => w.id === id);
      return item ? q.symbol !== item.symbol : true;
    }));
  }, [watchlist, loadWatchlist]);

  const getQuote = (symbol: string) => quotes.find(q => q.symbol === symbol);

  return (
    <div className="w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="titlebar-drag h-12 flex items-end px-4 pb-1 justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider titlebar-no-drag">
          Stocks {loading && <Spinner size="sm" />}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {watchlist.length === 0 && !showAdd && (
          <p className="text-xs text-gray-400 text-center py-4">
            No stocks. Add a symbol to track.
          </p>
        )}

        {watchlist.map(item => {
          const quote = getQuote(item.symbol);
          const isPositive = quote && quote.change >= 0;

          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 group"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.symbol}</div>
                <div className="text-xs text-gray-400 truncate">{item.displayName}</div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                {quote ? (
                  <>
                    <div className="text-sm font-mono">${quote.price.toFixed(2)}</div>
                    <div className={`text-xs font-mono ${
                      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">--</div>
                )}
              </div>
              <button
                onClick={() => handleRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 ml-1 text-gray-400 hover:text-red-500 text-xs"
                title="Remove"
              >
                x
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
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
