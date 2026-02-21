import React, { useState, useEffect } from 'react';
import { RssPanel } from './components/rss/RssPanel';
import { StockPanel } from './components/stocks/StockPanel';
import { useResizable } from './hooks/useResizable';

export function App() {
  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const [showAddStock, setShowAddStock] = useState(false);
  const stockPanel = useResizable({ initialWidth: 260, minWidth: 80, maxWidth: 450, storageKey: 'stockpanel-width', invert: true });

  useEffect(() => {
    const handleResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      
      if (e.key === 't' && isCmd) {
        e.preventDefault();
        setShowAddStock(prev => !prev);
        return;
      }

      // Don't handle other shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Responsive: Hide stocks if window is very narrow (mobile-like)
  const showStocks = winWidth > 400;

  return (
    <div className="h-screen flex flex-col overflow-hidden pt-1">
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* RSS panel fills remaining space */}
        <RssPanel parentWidth={winWidth - (showStocks ? stockPanel.width : 0)} />

        {/* Resize handle: RSS ↔ Stocks */}
        {showStocks && <div className="resize-handle" onMouseDown={stockPanel.onMouseDown} />}

        {/* Stock panel — resizable */}
        {showStocks && (
          <div
            style={{ width: stockPanel.width, flexShrink: 0 }}
            className="border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden"
          >
            <StockPanel 
              width={stockPanel.width} 
              showAdd={showAddStock} 
              onShowAdd={setShowAddStock}
            />
          </div>
        )}
      </div>

      {/* Status bar with keyboard hints */}
      <div className="h-6 flex items-center px-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 gap-4 flex-shrink-0">
        <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>j</kbd>/<kbd>k</kbd> navigate</span>
        <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>o</kbd> open</span>
        <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>s</kbd> star</span>
        <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>r</kbd> refresh</span>
        <span className="ml-auto flex gap-4">
          <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>t</kbd> add stock</span>
          <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>a</kbd> add feed</span>
          <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>d</kbd> add folder</span>
        </span>
      </div>
    </div>
  );
}
