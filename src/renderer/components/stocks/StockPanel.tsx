import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { WatchlistItem, StockGroup, StockQuote, StockDetail } from '../../../shared/types';
import { Spinner } from '../common/Spinner';

// ── Drag data MIME types ──
const DRAG_STOCK = 'application/x-stock-id';
const DRAG_GROUP = 'application/x-group-id';

type DropZone = 'above' | 'below' | 'center';

type DropIndicator =
  | { kind: 'stock'; id: number; zone: DropZone }
  | { kind: 'group'; id: number; zone: 'above' | 'below' | 'inside' }
  | null;

function getStockDropZone(e: React.DragEvent, el: HTMLElement): DropZone {
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height;
  if (y < h * 0.30) return 'above';
  if (y > h * 0.70) return 'below';
  return 'center';
}

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

// ── Stock row component ──
function StockRow({
  item,
  quote,
  isSelected,
  isPanelCollapsed,
  showPercent,
  dropIndicator,
  onSelect,
  onRemove,
  onTogglePercent,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  detail,
  detailLoading,
}: {
  item: WatchlistItem;
  quote: StockQuote | undefined;
  isSelected: boolean;
  isPanelCollapsed: boolean;
  showPercent: boolean;
  dropIndicator: DropZone | null;
  onSelect: (e: React.MouseEvent) => void;
  onRemove: () => void;
  onTogglePercent: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, zone: DropZone) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, zone: DropZone) => void;
  detail: StockDetail | null;
  detailLoading: boolean;
}) {
  const isPositive = quote && quote.change >= 0;

  return (
    <div
      className="relative"
      draggable
      onDragStart={onDragStart}
      onDragOver={e => {
        if (e.dataTransfer.types.includes(DRAG_STOCK)) {
          e.preventDefault();
          e.stopPropagation();
          const zone = getStockDropZone(e, e.currentTarget as HTMLElement);
          onDragOver(e, zone);
        }
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave();
        }
      }}
      onDrop={e => {
        if (!e.dataTransfer.types.includes(DRAG_STOCK)) return;
        e.preventDefault();
        e.stopPropagation();
        const zone = getStockDropZone(e, e.currentTarget as HTMLElement);
        onDrop(e, zone);
      }}
    >
      {dropIndicator === 'above' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded pointer-events-none z-10" />
      )}
      {dropIndicator === 'center' && (
        <div className="absolute inset-0 ring-2 ring-blue-500 ring-inset rounded pointer-events-none z-10" />
      )}

      <button
        onClick={onSelect}
        className={`w-full flex rounded group transition-colors text-left stock-trigger mb-0.5 ${
          isPanelCollapsed ? 'flex-col items-center justify-center p-2' : 'items-center justify-between p-2'
        } ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        {isPanelCollapsed ? (
          <>
            <div className="text-xs font-bold leading-tight truncate w-full text-center">{item.symbol}</div>
            {quote ? (
              <div className="flex flex-col items-center mt-1">
                <div className="text-[10px] font-mono leading-none">${formatNum(quote.price, 1)}</div>
                <div
                  onClick={onTogglePercent}
                  className={`text-[9px] font-mono leading-none mt-1 px-1 rounded cursor-pointer ${
                    isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {showPercent
                    ? `${isPositive ? '+' : ''}${formatNum(quote.changePercent, 1)}%`
                    : `${isPositive ? '+' : ''}${formatNum(quote.change, 1)}`}
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
                    onClick={onTogglePercent}
                    className={`text-[11px] font-mono cursor-pointer ${
                      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {showPercent
                      ? `${isPositive ? '+' : ''}${formatNum(quote.changePercent)}%`
                      : `${isPositive ? '+' : ''}${formatNum(quote.change)}`}
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-400">--</div>
              )}
            </div>
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              className="opacity-0 group-hover:opacity-100 ml-1.5 text-gray-400 hover:text-red-500 text-xs flex-shrink-0"
              title="Remove"
            >
              ×
            </button>
          </>
        )}
      </button>

      {!isPanelCollapsed && isSelected && (
        <div className="mx-1 mb-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-[11px]">
          <StockDetailContent detail={detail} loading={detailLoading} onExternal={window.api.shell.openExternal} />
        </div>
      )}

      {dropIndicator === 'below' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded pointer-events-none z-10" />
      )}
    </div>
  );
}

// ── Group header component ──
function GroupHeader({
  group,
  isCollapsed,
  isRenaming,
  renameValue,
  dropIndicator,
  onToggleCollapse,
  onStartRename,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  group: StockGroup;
  isCollapsed: boolean;
  isRenaming: boolean;
  renameValue: string;
  dropIndicator: 'above' | 'below' | 'inside' | null;
  onToggleCollapse: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  return (
    <div
      className="relative flex items-center group/ghdr py-1 cursor-pointer select-none"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dropIndicator === 'above' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded pointer-events-none z-10" />
      )}
      {dropIndicator === 'inside' && (
        <div className="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded pointer-events-none z-0" />
      )}

      <button
        onClick={onToggleCollapse}
        className="text-gray-400 mr-1 flex-shrink-0 text-[9px] w-3 text-center relative z-10"
        title={isCollapsed ? 'Expand' : 'Collapse'}
      >
        {isCollapsed ? '▶' : '▼'}
      </button>

      {isRenaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={e => {
            if (e.key === 'Enter') onRenameCommit();
            if (e.key === 'Escape') onRenameCancel();
          }}
          className="flex-1 text-[10px] font-bold uppercase tracking-wider bg-transparent border-b border-blue-500 focus:outline-none text-gray-500 dark:text-gray-400 relative z-10"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span
          onDoubleClick={e => { e.stopPropagation(); onStartRename(); }}
          className="flex-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate relative z-10"
          title="Double-click to rename"
        >
          {group.name}
        </span>
      )}

      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="opacity-0 group-hover/ghdr:opacity-100 text-gray-400 hover:text-red-500 text-xs ml-1 flex-shrink-0 relative z-10"
        title="Delete group (stocks become ungrouped)"
      >
        ×
      </button>

      {dropIndicator === 'below' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded pointer-events-none z-10" />
      )}
    </div>
  );
}

export function StockPanel({ width, showAdd, onShowAdd }: { width: number; showAdd?: boolean; onShowAdd?: (show: boolean) => void }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<StockGroup[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [localShowAdd, setLocalShowAdd] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const isAdding = showAdd !== undefined ? showAdd : localShowAdd;
  const setAdding = onShowAdd || setLocalShowAdd;

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showPercent, setShowPercent] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; right: number; flip: boolean } | null>(null);

  // Drag & drop
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

  // Group UI state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const isPanelCollapsed = width < 160;

  // ── Validation ──
  useEffect(() => {
    if (!symbol.trim()) { setIsValid(null); setIsValidating(false); return; }
    setIsValidating(true);
    const timer = setTimeout(async () => {
      try {
        const valid = await window.api.stocks.validate(symbol);
        setIsValid(valid);
      } catch { setIsValid(false); } finally { setIsValidating(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [symbol]);

  // ── Data loading ──
  const loadWatchlist = useCallback(async () => {
    const items = await window.api.stocks.watchlist();
    setWatchlist(items);
  }, []);

  const loadGroups = useCallback(async () => {
    const g = await window.api.stocks.groups.list();
    setGroups(g);
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

  useEffect(() => {
    Promise.all([loadWatchlist(), loadGroups()]).then(() => loadQuotes());
  }, [loadWatchlist, loadGroups, loadQuotes]);

  useEffect(() => {
    const interval = setInterval(loadQuotes, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadQuotes]);

  // ── Popover close ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverPosition && !(e.target as HTMLElement).closest('.stock-popover') && !(e.target as HTMLElement).closest('.stock-trigger')) {
        setPopoverPosition(null); setSelectedSymbol(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPopoverPosition(null); setSelectedSymbol(null); }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => { window.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('keydown', handleEsc); };
  }, [popoverPosition]);

  // ── CRUD handlers ──
  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    setError(null);
    try {
      await window.api.stocks.add(symbol.trim());
      setSymbol(''); setAdding(false);
      await loadWatchlist(); await loadQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add symbol');
    }
  }, [symbol, loadWatchlist, loadQuotes, setAdding]);

  const handleRemove = useCallback(async (id: number) => {
    const item = watchlist.find(w => w.id === id);
    await window.api.stocks.remove(id);
    if (item && selectedSymbol === item.symbol) {
      setSelectedSymbol(null); setDetail(null); setPopoverPosition(null);
    }
    await loadWatchlist();
    setQuotes(prev => prev.filter(q => item ? q.symbol !== item.symbol : true));
  }, [watchlist, loadWatchlist, selectedSymbol]);

  const handleSelectStock = useCallback(async (sym: string, e: React.MouseEvent) => {
    if (selectedSymbol === sym) {
      setSelectedSymbol(null); setDetail(null); setPopoverPosition(null); return;
    }
    setSelectedSymbol(sym); setDetailLoading(true); setDetail(null);
    if (isPanelCollapsed) {
      const rect = e.currentTarget.getBoundingClientRect();
      const flip = rect.top + 350 > window.innerHeight;
      setPopoverPosition({ top: flip ? rect.top - 5 : rect.bottom + 5, right: window.innerWidth - rect.right + (rect.width / 2) - 10, flip });
    }
    try {
      const d = await window.api.stocks.detail(sym);
      setDetail(d);
    } catch (err) { console.error('Failed to load detail:', err); }
    finally { setDetailLoading(false); }
  }, [selectedSymbol, isPanelCollapsed]);

  const getQuote = (sym: string) => quotes.find(q => q.symbol === sym);

  // ── Drag & drop handlers ──
  const handleStockDrop = useCallback(async (draggedId: number, targetItem: WatchlistItem, zone: DropZone) => {
    const dragged = watchlist.find(w => w.id === draggedId);
    if (!dragged || draggedId === targetItem.id) return;

    if (zone === 'center') {
      if (targetItem.groupId !== null) {
        // Join target's existing group
        await window.api.stocks.move(draggedId, targetItem.groupId);
      } else {
        // Both ungrouped → create a new group
        const group = await window.api.stocks.groups.create('Group');
        await window.api.stocks.move(targetItem.id, group.id);
        await window.api.stocks.move(draggedId, group.id);
        setRenamingGroupId(group.id);
        setRenameValue('Group');
      }
    } else {
      // above / below: reorder, possibly moving between groups
      if (dragged.groupId !== targetItem.groupId) {
        await window.api.stocks.move(draggedId, targetItem.groupId);
      }
      const contextItems = watchlist
        .filter(w => w.groupId === targetItem.groupId && w.id !== draggedId)
        .sort((a, b) => a.position - b.position);
      const targetIdx = contextItems.findIndex(w => w.id === targetItem.id);
      contextItems.splice(zone === 'above' ? targetIdx : targetIdx + 1, 0, dragged);
      await window.api.stocks.reorder(contextItems.map(w => w.id));
    }

    await loadWatchlist();
    await loadGroups();
  }, [watchlist, loadWatchlist, loadGroups]);

  const handleDropOnGroupHeader = useCallback(async (draggedId: number, targetGroupId: number) => {
    await window.api.stocks.move(draggedId, targetGroupId);
    await loadWatchlist();
  }, [loadWatchlist]);

  const handleGroupReorder = useCallback(async (draggedGroupId: number, targetGroupId: number, zone: 'above' | 'below') => {
    const sorted = [...groups].sort((a, b) => a.position - b.position);
    const withoutDragged = sorted.filter(g => g.id !== draggedGroupId);
    const dragged = groups.find(g => g.id === draggedGroupId);
    if (!dragged) return;
    const targetIdx = withoutDragged.findIndex(g => g.id === targetGroupId);
    withoutDragged.splice(zone === 'above' ? targetIdx : targetIdx + 1, 0, dragged);
    await window.api.stocks.groups.reorder(withoutDragged.map(g => g.id));
    await loadGroups();
  }, [groups, loadGroups]);

  const handleRenameGroup = useCallback(async () => {
    if (renamingGroupId === null) return;
    if (renameValue.trim()) {
      await window.api.stocks.groups.rename(renamingGroupId, renameValue.trim());
      await loadGroups();
    }
    setRenamingGroupId(null);
  }, [renamingGroupId, renameValue, loadGroups]);

  const handleDeleteGroup = useCallback(async (groupId: number) => {
    await window.api.stocks.groups.delete(groupId);
    await Promise.all([loadWatchlist(), loadGroups()]);
  }, [loadWatchlist, loadGroups]);

  const toggleGroupCollapse = useCallback((groupId: number) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }, []);

  // ── Derived data ──
  const sortedGroups = [...groups].sort((a, b) => a.position - b.position);
  const ungrouped = watchlist.filter(w => w.groupId === null).sort((a, b) => a.position - b.position);

  const stockRowProps = (item: WatchlistItem) => ({
    item,
    quote: getQuote(item.symbol),
    isSelected: selectedSymbol === item.symbol,
    isPanelCollapsed,
    showPercent,
    detail: selectedSymbol === item.symbol ? detail : null,
    detailLoading: selectedSymbol === item.symbol ? detailLoading : false,
    dropIndicator: (dropIndicator?.kind === 'stock' && dropIndicator.id === item.id ? dropIndicator.zone : null) as DropZone | null,
    onSelect: (e: React.MouseEvent) => handleSelectStock(item.symbol, e),
    onRemove: () => handleRemove(item.id),
    onTogglePercent: (e: React.MouseEvent) => { e.stopPropagation(); setShowPercent(p => !p); },
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_STOCK, String(item.id));
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (_e: React.DragEvent, zone: DropZone) => setDropIndicator({ kind: 'stock', id: item.id, zone }),
    onDragLeave: () => setDropIndicator(null),
    onDrop: (e: React.DragEvent, zone: DropZone) => {
      const draggedId = Number(e.dataTransfer.getData(DRAG_STOCK));
      if (draggedId) handleStockDrop(draggedId, item, zone);
      setDropIndicator(null);
    },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Title bar */}
      <div className={`titlebar-drag h-12 flex px-4 pb-1 justify-between flex-shrink-0 ${isPanelCollapsed ? 'items-center justify-center px-1' : 'items-end'}`}>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider titlebar-no-drag flex items-center gap-1">
          {isPanelCollapsed ? 'STK' : 'Stocks'} {loading && <Spinner size="sm" />}
        </span>
      </div>

      {/* Main list */}
      <div className={`flex-1 overflow-y-auto ${isPanelCollapsed ? 'px-1 py-2' : 'px-3 py-2'}`}>
        {watchlist.length === 0 && groups.length === 0 && !isAdding && !isPanelCollapsed && (
          <div className="py-8 px-2">
            <p className="text-xs text-gray-400 text-center mb-6">No stocks tracked yet.</p>
            <TickerLegend />
          </div>
        )}

        {/* Groups */}
        {sortedGroups.map(group => {
          const groupStocks = watchlist.filter(w => w.groupId === group.id).sort((a, b) => a.position - b.position);
          const isGroupCollapsed = collapsedGroups.has(group.id);

          const groupHeaderDragOver = (e: React.DragEvent) => {
            const hasStock = e.dataTransfer.types.includes(DRAG_STOCK);
            const hasGroup = e.dataTransfer.types.includes(DRAG_GROUP);
            if (hasStock) {
              e.preventDefault(); e.stopPropagation();
              setDropIndicator({ kind: 'group', id: group.id, zone: 'inside' });
            } else if (hasGroup) {
              e.preventDefault(); e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const zone = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
              setDropIndicator({ kind: 'group', id: group.id, zone });
            }
          };

          const groupHeaderDrop = (e: React.DragEvent) => {
            e.preventDefault(); e.stopPropagation();
            const stockId = e.dataTransfer.getData(DRAG_STOCK);
            const grpId = e.dataTransfer.getData(DRAG_GROUP);
            if (stockId) {
              handleDropOnGroupHeader(Number(stockId), group.id);
            } else if (grpId && Number(grpId) !== group.id) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const zone = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
              handleGroupReorder(Number(grpId), group.id, zone);
            }
            setDropIndicator(null);
          };

          return (
            <div key={group.id} className="mb-1">
              {!isPanelCollapsed && (
                <GroupHeader
                  group={group}
                  isCollapsed={isGroupCollapsed}
                  isRenaming={renamingGroupId === group.id}
                  renameValue={renameValue}
                  dropIndicator={dropIndicator?.kind === 'group' && dropIndicator.id === group.id ? dropIndicator.zone : null}
                  onToggleCollapse={() => toggleGroupCollapse(group.id)}
                  onStartRename={() => { setRenamingGroupId(group.id); setRenameValue(group.name); }}
                  onRenameChange={setRenameValue}
                  onRenameCommit={handleRenameGroup}
                  onRenameCancel={() => setRenamingGroupId(null)}
                  onDelete={() => handleDeleteGroup(group.id)}
                  onDragStart={e => {
                    e.dataTransfer.setData(DRAG_GROUP, String(group.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={groupHeaderDragOver}
                  onDragLeave={() => setDropIndicator(null)}
                  onDrop={groupHeaderDrop}
                />
              )}

              {(!isGroupCollapsed || isPanelCollapsed) && groupStocks.map(item => (
                <StockRow key={item.id} {...stockRowProps(item)} />
              ))}
            </div>
          );
        })}

        {/* Ungrouped stocks */}
        {ungrouped.length > 0 && groups.length > 0 && !isPanelCollapsed && (
          <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
        )}
        {ungrouped.map(item => (
          <StockRow key={item.id} {...stockRowProps(item)} />
        ))}

        {!isPanelCollapsed && isAdding && (
          <div className="mt-4 px-1">
            <TickerLegend />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        {isAdding ? (
          <form onSubmit={handleAdd} className="space-y-2">
            {!isPanelCollapsed ? (
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
            ) : (
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
                {isValidating ? '...' : (isPanelCollapsed ? '+' : 'Add')}
              </button>
              <button type="button" onClick={() => { setAdding(false); setError(null); setSymbol(''); }} className="px-1 py-1 text-[10px] bg-gray-200 dark:bg-gray-700 rounded">×</button>
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
              + {isPanelCollapsed ? '' : 'Add'}
            </button>
            {!isPanelCollapsed && (
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

      {/* Collapsed popover */}
      {isPanelCollapsed && popoverPosition && selectedSymbol && (
        <div
          className="stock-popover fixed z-50 w-72 bg-white dark:bg-gray-900 shadow-2xl rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-xs animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: popoverPosition.flip ? undefined : popoverPosition.top,
            bottom: popoverPosition.flip ? (window.innerHeight - popoverPosition.top) : undefined,
            right: popoverPosition.right,
          }}
        >
          <div className={`absolute right-1/2 translate-x-1/2 w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 ${
            popoverPosition.flip ? 'border-b border-r -bottom-1.5' : 'border-t border-l -top-1.5'
          }`} />
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

function getYahooUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}

function getFinvizUrl(symbol: string): string | null {
  // Only US stocks: exclude futures (=F), currencies (=X), indices (^),
  // crypto/pairs (-), and foreign stocks (.XX exchange suffix e.g. ASML.AS)
  if (symbol.includes('=') || symbol.startsWith('^') || symbol.includes('-') || /\.[A-Z]{2,}/.test(symbol)) {
    return null;
  }
  return `https://finviz.com/quote.ashx?t=${symbol}`;
}

function StockDetailContent({ detail, loading, onExternal }: { detail: StockDetail | null; loading: boolean; onExternal: (url: string) => void }) {
  if (loading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>;
  if (!detail) return <p className="text-gray-400 text-center py-4">Could not load details</p>;

  const yahooUrl = getYahooUrl(detail.symbol);
  const finvizUrl = getFinvizUrl(detail.symbol);

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
      <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800 flex gap-1.5 justify-end">
        <button
          onClick={e => { e.stopPropagation(); onExternal(yahooUrl); }}
          className="text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
        >
          Yahoo →
        </button>
        {finvizUrl && (
          <button
            onClick={e => { e.stopPropagation(); onExternal(finvizUrl); }}
            className="text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          >
            FinViz →
          </button>
        )}
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
      <div className="mt-4 text-[9px] text-gray-400 italic">Enter symbol in the add box above.</div>
    </div>
  );
}
