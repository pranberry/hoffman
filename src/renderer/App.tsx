import React from 'react';
import { RssPanel } from './components/rss/RssPanel';
import { StockPanel } from './components/stocks/StockPanel';

export function App() {
  return (
    <div className="h-screen flex flex-col">
      {/* Keyboard shortcut hints */}
      <div className="flex h-full">
        <RssPanel />
        <StockPanel />
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
