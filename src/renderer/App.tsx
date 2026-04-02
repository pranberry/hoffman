import React, { useState, useEffect } from 'react';
import { RssPanel } from './components/rss/RssPanel';
import { StockPanel } from './components/stocks/StockPanel';
import { TSXHeatmap } from './components/heatmap/TSXHeatmap';
import { useResizable } from './hooks/useResizable';

type ActiveTab = 'feed' | 'heatmap';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [triggerStar, setTriggerStar] = useState(0);

  const stockPanel = useResizable({
    initialWidth: 260,
    minWidth: 100,
    maxWidth: 450,
    storageKey: 'stockpanel-width',
    invert: true
  });

  useEffect(() => {
    const handleResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();

      if (isCmd && isShift) {
        if (key === 't') {
          e.preventDefault();
          setShowAddStock(prev => !prev);
          return;
        }
        if (key === 'f') {
          e.preventDefault();
          setShowAddFolder(false);
          setShowAddFeed(prev => !prev);
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          setShowAddFeed(false);
          setShowAddFolder(prev => !prev);
          return;
        }
        if (key === 's') {
          e.preventDefault();
          setTriggerStar(prev => prev + 1);
          return;
        }
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const showStocks = winWidth > 400;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center gap-0 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 titlebar-drag" style={{ paddingLeft: 80 }}>
        <button
          onClick={() => setActiveTab('feed')}
          className={`titlebar-no-drag px-4 py-1.5 text-xs font-medium transition-colors relative ${
            activeTab === 'feed'
              ? 'text-gray-900 dark:text-gray-100'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Feed
          {activeTab === 'feed' && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`titlebar-no-drag px-4 py-1.5 text-xs font-medium transition-colors relative ${
            activeTab === 'heatmap'
              ? 'text-gray-900 dark:text-gray-100'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          Heatmap
          {activeTab === 'heatmap' && (
            <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'feed' ? (
        <>
          <div className="flex flex-1 min-h-0 min-w-0">
            <RssPanel
              parentWidth={winWidth - (showStocks ? stockPanel.width : 0)}
              showAddFeed={showAddFeed}
              onShowAddFeed={setShowAddFeed}
              showAddFolder={showAddFolder}
              onShowAddFolder={setShowAddFolder}
              triggerStar={triggerStar}
            />

            {showStocks && <div className="resize-handle" onMouseDown={stockPanel.onMouseDown} />}

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

          {/* Status Bar */}
          <div className="h-6 flex items-center px-4 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 gap-4 flex-shrink-0">
            <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>j</kbd>/<kbd>k</kbd> navigate</span>
            <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>r</kbd> refresh</span>
            <span className="ml-auto flex gap-4">
              <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>⇧</kbd>+<kbd>S</kbd> star</span>
              <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>⇧</kbd>+<kbd>T</kbd> add stock</span>
              <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>⇧</kbd>+<kbd>F</kbd> add feed</span>
              <span><kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</kbd>+<kbd>⇧</kbd>+<kbd>D</kbd> add folder</span>
            </span>
          </div>
        </>
      ) : (
        <TSXHeatmap />
      )}
    </div>
  );
}
