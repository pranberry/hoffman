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

export function StockPanel({ width, showAdd, onShowAdd }: { width: number; showAdd?: boolean; onShowAdd?: (show: boolean) => void }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [localShowAdd, setLocalShowAdd] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Sync internal state with prop if provided
  const isAdding = showAdd !== undefined ? showAdd : localShowAdd;
  const setAdding = onShowAdd || setLocalShowAdd;

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; right: number; flip: boolean } | null>(null);

  const isCollapsed = width < 160;

  // Validation effect
  useEffect(() => {
    if (!symbol.trim()) {
      setIsValid(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    const timer = setTimeout(async () => {
      try {
        const valid = await window.api.stocks.validate(symbol);
        setIsValid(valid);
      } catch {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [symbol]);

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

  // Handle outside click for popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverPosition && !(e.target as HTMLElement).closest('.stock-popover') && !(e.target as HTMLElement).closest('.stock-trigger')) {
        setPopoverPosition(null);
        setSelectedSymbol(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopoverPosition(null);
        setSelectedSymbol(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [popoverPosition]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    setError(null);
    try {
      await window.api.stocks.add(symbol.trim());
      setSymbol('');
      setAdding(false);
      await loadWatchlist();
      await loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add symbol');
    }
  }, [symbol, loadWatchlist, loadQuotes, setAdding]);

  const handleRemove = useCallback(async (id: number) => {
    const item = watchlist.find(w => w.id === id);
    await window.api.stocks.remove(id);
    if (item && selectedSymbol === item.symbol) {
      setSelectedSymbol(null);
      setDetail(null);
      setPopoverPosition(null);
    }
    await loadWatchlist();
    setQuotes(prev => prev.filter(q => {
      return item ? q.symbol !== item.symbol : true;
    }));
  }, [watchlist, loadWatchlist, selectedSymbol]);

  const handleSelectStock = useCallback(async (sym: string, e: React.MouseEvent) => {
    if (selectedSymbol === sym) {
      setSelectedSymbol(null);
      setDetail(null);
      setPopoverPosition(null);
      return;
    }

    setSelectedSymbol(sym);
    setDetailLoading(true);
    setDetail(null);

    if (isCollapsed) {
      const rect = e.currentTarget.getBoundingClientRect();
      const flip = rect.top + 350 > window.innerHeight; // Heuristic for detail height
      setPopoverPosition({
        top: flip ? rect.top - 5 : rect.bottom + 5,
        right: window.innerWidth - rect.right + (rect.width / 2) - 10,
        flip
      });
    }

    try {
      const d = await window.api.stocks.detail(sym);
      setDetail(d);
    } catch (err) {
      console.error('Failed to load detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedSymbol, isCollapsed]);

  const getQuote = (sym: string) => quotes.find(q => q.symbol === sym);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={`titlebar-drag h-12 flex px-4 pb-1 justify-between flex-shrink-0 ${isCollapsed ? 'items-center justify-center px-1' : 'items-end'}`}>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider titlebar-no-drag flex items-center gap-1">
          {isCollapsed ? 'STK' : 'Stocks'} {loading && <Spinner size="sm" />}
        </span>
      </div>

      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'px-1 py-2' : 'px-3 py-2'}`}>
        {watchlist.length === 0 && !isAdding && !isCollapsed && (
          <div className="py-8 px-2">
            <p className="text-xs text-gray-400 text-center mb-6">
              No stocks tracked yet.
            </p>
            <TickerLegend />
          </div>
        )}

        {watchlist.map(item => {
          const quote = getQuote(item.symbol);
          const isPositive = quote && quote.change >= 0;
          const isSelected = selectedSymbol === item.symbol;

          return (
            <div key={item.id} className="relative">
              <button
                onClick={(e) => handleSelectStock(item.symbol, e)}
                className={`w-full flex rounded group transition-colors text-left stock-trigger mb-0.5 ${
                  isCollapsed ? 'flex-col items-center justify-center p-2' : 'items-center justify-between p-2'
                } ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {isCollapsed ? (
                  <>
                    <div className="text-xs font-bold leading-tight truncate w-full text-center">{item.symbol}</div>
                    {quote ? (
                      <div className="flex flex-col items-center mt-1">
                        <div className="text-[10px] font-mono leading-none">${formatNum(quote.price, 1)}</div>
                        <div
                          onClick={(e) => { e.stopPropagation(); setShowPercent(!showPercent); }}
                          className={`text-[9px] font-mono leading-none mt-1 px-1 rounded cursor-pointer ${
                            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {showPercent
                            ? `${isPositive ? '+' : ''}${formatNum(quote.changePercent, 1)}%`
                            : `${isPositive ? '+' : ''}${formatNum(quote.change, 1)}`
                          }
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400">--</div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{item.symbol}</div>
                      <div className="text-[11px] text-gray-400 truncate">{item.displayName}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      {quote ? (
                        <>
                          <div className="text-sm font-mono">${formatNum(quote.price)}</div>
                          <div
                            onClick={(e) => { e.stopPropagation(); setShowPercent(!showPercent); }}
                            className={`text-[11px] font-mono cursor-pointer ${
                              isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {showPercent
                              ? `${isPositive ? '+' : ''}${formatNum(quote.changePercent)}%`
                              : `${isPositive ? '+' : ''}${formatNum(quote.change)}`
                            }
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
                  </>
                )}
              </button>

              {/* Inline detail panel for large view */}
              {!isCollapsed && isSelected && (
                <div className="mx-1 mb-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-[11px]">
                  <StockDetailContent detail={detail} loading={detailLoading} onExternal={window.api.shell.openExternal} />
                </div>
              )}
            </div>
          );
        })}

        {!isCollapsed && isAdding && (
          <div className="mt-4 px-1">
            <TickerLegend />
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        {isAdding ? (
          <form onSubmit={handleAdd} className="space-y-2">
            {!isCollapsed && (
              <input
                type="text"
                placeholder="Symbol (e.g. AAPL)..."
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                className={`w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  symbol && isValid === true ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 
                  symbol && isValid === false ? 'text-orange-600 dark:text-orange-400' : ''
                }`}
                autoFocus
              />
            )}
            {isCollapsed && (
               <input
               type="text"
               placeholder="SYM"
               value={symbol}
               onChange={e => setSymbol(e.target.value)}
               className={`w-full px-1 py-0.5 text-[10px] rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 ${
                symbol && isValid === true ? 'text-cyan-600 dark:text-cyan-400 font-bold' : 
                symbol && isValid === false ? 'text-orange-600 dark:text-orange-400' : ''
              }`}
               autoFocus
             />
            )}
            <div className="flex gap-1">
              <button 
                type="submit" 
                disabled={isValid !== true || isValidating}
                className={`flex-1 px-1 py-1 text-[10px] text-white rounded transition-colors ${
                  isValid === true ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
                }`}
              >
                {isValidating ? '...' : (isCollapsed ? '+' : 'Add')}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError(null); setSymbol(''); }} className="px-1 py-1 text-[10px] bg-gray-200 dark:bg-gray-700 rounded">x</button>
            </div>
            {error && <div className="text-[10px] text-red-500 mt-1 px-1">{error}</div>}
          </form>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => setAdding(true)}
              className="flex-1 px-1 py-1.5 text-[10px] bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              title="Add stock"
            >
              + {isCollapsed ? '' : 'Add'}
            </button>
            {!isCollapsed && (
              <button
                onClick={loadQuotes}
                className="px-2 py-1.5 text-[10px] bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                title="Refresh quotes"
              >
                Refresh
              </button>
            )}
          </div>
        )}
      </div>

      {/* Non-modal anchored popover for collapsed detail */}
      {isCollapsed && popoverPosition && selectedSymbol && (
        <div 
          className="stock-popover fixed z-50 w-72 bg-white dark:bg-gray-900 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-xs animate-in fade-in zoom-in-95 duration-200"
          style={{ 
            top: popoverPosition.flip ? undefined : popoverPosition.top,
            bottom: popoverPosition.flip ? (window.innerHeight - popoverPosition.top) : undefined,
            right: popoverPosition.right,
          }}
        >
          {/* Beak/Arrow */}
          <div 
            className={`absolute right-1/2 translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 ${
              popoverPosition.flip ? 'border-b border-r -bottom-1.5' : 'border-t border-l -top-1.5'
            }`}
          />
          <div className="relative">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold">{selectedSymbol}</h3>
              <button onClick={() => { setPopoverPosition(null); setSelectedSymbol(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <StockDetailContent detail={detail} loading={detailLoading} onExternal={window.api.shell.openExternal} />
          </div>
        </div>
      )}
    </div>
  );
}

function StockDetailContent({ detail, loading, onExternal }: { detail: StockDetail | null; loading: boolean; onExternal: (url: string) => void }) {
  if (loading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>;
  if (!detail) return <p className="text-gray-400 text-center py-4">Could not load details</p>;

  return (
    <div className="space-y-0.5">
      <div className="text-sm font-semibold mb-3 pb-1 border-b border-gray-100 dark:border-gray-800">{detail.name}</div>

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
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-800 text-[10px] uppercase text-gray-400 font-bold tracking-wider">Analyst Sentiment</div>
          {detail.targetMeanPrice != null && <DetailRow label="Target Price" value={`$${formatNum(detail.targetMeanPrice)}`} />}
          {detail.recommendationKey != null && <DetailRow label="Rating" value={detail.recommendationKey.toUpperCase()} />}
          {detail.numberOfAnalystOpinions != null && <DetailRow label="# Analysts" value={String(detail.numberOfAnalystOpinions)} />}
        </>
      )}

      <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExternal(`https://finviz.com/quote.ashx?t=${detail.symbol}`);
          }}
          className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
        >
          View on FinViz →
        </button>
      </div>
    </div>
  );
}

function TickerLegend() {
  const categories = [
    { label: 'Bonds', symbols: ['^TNX (10Y)', '^TYX (30Y)', '^IRX (13W)'] },
    { label: 'Commodities', symbols: ['GC=F (Gold)', 'SI=F (Silver)', 'CL=F (Oil)'] },
    { label: 'Crypto', symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'] },
    { label: 'Currencies', symbols: ['EURUSD=X', 'JPY=X', 'GBPUSD=X'] },
  ];

  return (
    <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-100 dark:border-gray-800/50">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-800/50 pb-1">
        Yahoo Finance Guide
      </div>
      <div className="grid grid-cols-1 gap-4">
        {categories.map(cat => (
          <div key={cat.label}>
            <div className="text-[10px] text-gray-500 font-semibold mb-1.5 uppercase tracking-tighter">{cat.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {cat.symbols.map(s => (
                <code key={s} className="text-[10px] font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">
                  {s}
                </code>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-[9px] text-gray-400 italic">
        Enter symbol in the add box above.
      </div>
    </div>
  );
}

