import React, { useState, useEffect } from 'react';
import { RssPanel } from './components/rss/RssPanel';
import { StockPanel } from './components/stocks/StockPanel';
import { useResizable } from './hooks/useResizable';

/**
 * ── ARCHITECTURAL OVERVIEW: UI COMPOSITION ──
 * This is the root component of the Renderer process. 
 * It manages the high-level layout, resizable panels, and global keyboard shortcuts.
 */
export function App() {
  // Local state for layout and UI triggers
  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [triggerStar, setTriggerStar] = useState(0);

  /**
   * Resizable Hook: Manages the width of the Stock Panel.
   * Persists the width to localStorage automatically.
   */
  const stockPanel = useResizable({ 
    initialWidth: 260, 
    minWidth: 80, 
    maxWidth: 450, 
    storageKey: 'stockpanel-width', 
    invert: true 
  });

  // Keep track of window width for responsive calculations
  useEffect(() => {
    const handleResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * GLOBAL KEYBOARD SHORTCUTS
   * Maps physical keys to app actions via the IPC bridge.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();
      
      if (isCmd && isShift) {
        // Cmd+Shift+T: Toggle Add Stock dialog
        if (key === 't') {
          e.preventDefault();
          setShowAddStock(prev => !prev);
          return;
        }
        // Cmd+Shift+F: Toggle Add Feed dialog
        if (key === 'f') {
          e.preventDefault();
          setShowAddFolder(false);
          setShowAddFeed(prev => !prev);
          return;
        }
        // Cmd+Shift+D: Toggle Add Folder dialog
        if (key === 'd') {
          e.preventDefault();
          setShowAddFeed(false);
          setShowAddFolder(prev => !prev);
          return;
        }
        // Cmd+Shift+S: Star current article
        if (key === 's') {
          e.preventDefault();
          setTriggerStar(prev => prev + 1);
          return;
        }
      }

      // Ignore global shortcuts if the user is currently typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Simple responsiveness: hide the stock panel if the window is too small
  const showStocks = winWidth > 400;

  return (
    <div className="h-screen flex flex-col overflow-hidden pt-1">
      <div className="flex flex-1 min-h-0 min-w-0">
        
        {/* RSS PANEL: The primary content area. Resizes dynamically based on available space. */}
        <RssPanel 
          parentWidth={winWidth - (showStocks ? stockPanel.width : 0)} 
          showAddFeed={showAddFeed}
          onShowAddFeed={setShowAddFeed}
          showAddFolder={showAddFolder}
          onShowAddFolder={setShowAddFolder}
          triggerStar={triggerStar}
        />

        {/* DRAGGABLE DIVIDER: Allows manual resizing of the Stock panel */}
        {showStocks && <div className="resize-handle" onMouseDown={stockPanel.onMouseDown} />}

        {/* STOCK PANEL: Secondary information area on the right. */}
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

      {/* STATUS BAR: Minimalistic footer with keyboard accessibility hints */}
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
    </div>
  );
}
