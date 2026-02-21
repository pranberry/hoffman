import React from 'react';
import { RssPanel } from './components/rss/RssPanel';
import { StockPanel } from './components/stocks/StockPanel';
import { useResizable } from './hooks/useResizable';

export function App() {
  const stockPanel = useResizable({ initialWidth: 260, minWidth: 180, maxWidth: 450, storageKey: 'stockpanel-width' });

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* RSS panel fills remaining space */}
        <RssPanel />

        {/* Resize handle: RSS ↔ Stocks */}
        <div className="resize-handle" onMouseDown={stockPanel.onMouseDown} />

        {/* Stock panel — resizable */}
        <div
          style={{ width: stockPanel.width, flexShrink: 0 }}
          className="border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden"
        >
          <StockPanel />
        </div>
      </div>

      {/* Status bar with keyboard hints */}
      <div className="h-6 flex items-center px-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 gap-4 flex-shrink-0">
        <span><kbd>j</kbd>/<kbd>k</kbd> navigate</span>
        <span><kbd>o</kbd> open in browser</span>
        <span><kbd>s</kbd> star</span>
        <span><kbd>r</kbd> refresh</span>
      </div>
    </div>
  );
}
