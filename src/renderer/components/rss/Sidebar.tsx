import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Folder, Feed } from '../../../shared/types';

interface SidebarProps {
  folders: Folder[];
  feeds: Feed[];
  selectedFeedId: number | null;
  selectedFolderId: number | null;
  showStarred: boolean;
  showAddFeedForm: boolean;
  showAddFolderForm: boolean;
  onShowAddFeed: (show: boolean) => void;
  onShowAddFolder: (show: boolean) => void;
  onSelectFeed: (feedId: number | null) => void;
  onSelectFolder: (folderId: number | null) => void;
  onSelectStarred: () => void;
  onSelectAll: () => void;
  onAddFeed: (url: string, folderId: number | null) => void;
  onRemoveFeed: (id: number) => void;
  onRenameFeed: (id: number, title: string) => void;
  onUpdateFeedUrl: (id: number, url: string) => void;
  onMoveFeed: (id: number, folderId: number | null) => void;
  onReorderFeeds: (ids: number[]) => void;
  onAddFolder: (name: string) => void;
  onDeleteFolder: (id: number) => void;
  onRefresh: () => void;
  onShowSettings: () => void;
}

// ── Inline editable feed name/URL ──
function EditableFeedName({
  feed,
  isSelected,
  indented,
  onSelect,
  onRename,
  onUpdateUrl,
}: {
  feed: Feed;
  isSelected: boolean;
  indented: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onUpdateUrl: (url: string) => void;
}) {
  const [editing, setEditing] = useState<'title' | 'url' | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (editing === 'title') {
      if (trimmed && trimmed !== feed.title) {
        onRename(trimmed);
      }
    } else if (editing === 'url') {
      if (trimmed && trimmed !== feed.url) {
        onUpdateUrl(trimmed);
      }
    }
    setEditing(null);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(null); }
        }}
        placeholder={editing === 'url' ? 'https://...' : 'Feed title...'}
        className={`w-full ${indented ? 'pl-6 pr-2' : 'px-3'} py-1 text-sm rounded border border-blue-400 bg-white dark:bg-gray-800 focus:outline-none`}
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        onSelect();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setValue(feed.url);
        setEditing('url');
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setValue(feed.title || feed.url);
        setEditing('title');
      }}
      className={`flex-1 text-left ${indented ? 'pl-6 pr-3' : 'px-3'} py-1.5 rounded text-sm truncate ${
        isSelected ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
      }`}
      title="Double-click to rename, Right-click to edit URL"
    >
      {feed.title || feed.url}
      {feed.errorMessage && <span className="ml-1 text-red-400" title={feed.errorMessage}>!</span>}
    </button>
  );
}

// ── Draggable feed row ──
function DraggableFeed({
  feed,
  isSelected,
  indented,
  dropIndicator,
  onSelect,
  onRemove,
  onRename,
  onUpdateUrl,
  onDragOverFeed,
  onDragLeaveFeed,
  onDropOnFeed,
}: {
  feed: Feed;
  isSelected: boolean;
  indented: boolean;
  dropIndicator: 'above' | 'below' | null;
  onSelect: () => void;
  onRemove: () => void;
  onRename: (title: string) => void;
  onUpdateUrl: (url: string) => void;
  onDragOverFeed: (above: boolean) => void;
  onDragLeaveFeed: () => void;
  onDropOnFeed: (draggedId: number, draggedFolderId: number | null, above: boolean) => void;
}) {
  return (
    <div
      className="flex items-center group relative"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/x-feed-id', String(feed.id));
        e.dataTransfer.setData('application/x-feed-folder-id', feed.folderId === null ? 'null' : String(feed.folderId));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('application/x-feed-id')) {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onDragOverFeed(e.clientY < rect.top + rect.height / 2);
        }
      }}
      onDragLeave={onDragLeaveFeed}
      onDrop={e => {
        const draggedId = Number(e.dataTransfer.getData('application/x-feed-id'));
        const folderStr = e.dataTransfer.getData('application/x-feed-folder-id');
        const draggedFolderId = folderStr === 'null' ? null : Number(folderStr);
        if (!draggedId || draggedId === feed.id) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onDropOnFeed(draggedId, draggedFolderId, e.clientY < rect.top + rect.height / 2);
        onDragLeaveFeed();
      }}
    >
      {dropIndicator === 'above' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded pointer-events-none z-10" />
      )}
      <EditableFeedName
        feed={feed}
        isSelected={isSelected}
        indented={indented}
        onSelect={onSelect}
        onRename={onRename}
        onUpdateUrl={onUpdateUrl}
      />
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 px-1 text-gray-400 hover:text-red-500 text-xs"
        title="Remove feed"
      >
        ×
      </button>
      {dropIndicator === 'below' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded pointer-events-none z-10" />
      )}
    </div>
  );
}

export function Sidebar({
  folders, feeds, selectedFeedId, selectedFolderId, showStarred,
  showAddFeedForm, showAddFolderForm, onShowAddFeed, onShowAddFolder,
  onSelectFeed, onSelectFolder, onSelectStarred, onSelectAll,
  onAddFeed, onRemoveFeed, onRenameFeed, onUpdateFeedUrl, onMoveFeed, onReorderFeeds, onAddFolder, onDeleteFolder, onRefresh,
  onShowSettings,
}: SidebarProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [feedFolderId, setFeedFolderId] = useState<number | null>(null);
  const [folderName, setFolderName] = useState('');
  const [dragOverFeedId, setDragOverFeedId] = useState<number | null>(null);
  const [dropAbove, setDropAbove] = useState(false);

  const handleAddFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedUrl.trim()) {
      onAddFeed(feedUrl.trim(), feedFolderId);
      setFeedUrl('');
      onShowAddFeed(false);
    }
  };

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onAddFolder(folderName.trim());
      setFolderName('');
      onShowAddFolder(false);
    }
  };

  // ── Drop handler for folders ──
  const makeFolderDropHandlers = useCallback((folderId: number | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('application/x-feed-id')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        (e.currentTarget as HTMLElement).classList.add('bg-blue-50', 'dark:bg-blue-900/20');
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      (e.currentTarget as HTMLElement).classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
      const feedId = Number(e.dataTransfer.getData('application/x-feed-id'));
      if (feedId) onMoveFeed(feedId, folderId);
    },
  }), [onMoveFeed]);

  const handleFeedDrop = useCallback((draggedId: number, draggedFolderId: number | null, targetId: number, above: boolean) => {
    const draggedFeed = feeds.find(f => f.id === draggedId);
    const targetFeed = feeds.find(f => f.id === targetId);
    if (!draggedFeed || !targetFeed) return;

    if (draggedFolderId !== targetFeed.folderId) {
      // Cross-folder: just move to the target's folder
      onMoveFeed(draggedId, targetFeed.folderId);
      return;
    }

    // Same folder: reorder within the group
    const groupFeeds = feeds.filter(f => f.folderId === draggedFeed.folderId);
    const withoutDragged = groupFeeds.filter(f => f.id !== draggedId);
    const targetIdx = withoutDragged.findIndex(f => f.id === targetId);
    withoutDragged.splice(above ? targetIdx : targetIdx + 1, 0, draggedFeed);
    onReorderFeeds(withoutDragged.map(f => f.id));
  }, [feeds, onMoveFeed, onReorderFeeds]);

  const unfolderedFeeds = feeds.filter(f => f.folderId === null);
  const isAllSelected = !selectedFeedId && !selectedFolderId && !showStarred;

  return (
    <div className="flex flex-col h-full">
      {/* Drag region for macOS title bar */}
      <div className="titlebar-drag h-12 flex items-end px-4 pb-1">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider titlebar-no-drag">Feeds</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {/* All articles */}
        <button
          onClick={onSelectAll}
          className={`w-full text-left px-3 py-1.5 rounded text-sm ${
            isAllSelected ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
          }`}
        >
          All Articles
        </button>

        {/* Starred */}
        <button
          onClick={onSelectStarred}
          className={`w-full text-left px-3 py-1.5 rounded text-sm ${
            showStarred ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
          }`}
        >
          Starred
        </button>

        <div className="border-t border-gray-200 dark:border-gray-800 my-2" />

        {/* Folders — each is a drop target */}
        {folders.map(folder => {
          const folderFeeds = feeds.filter(f => f.folderId === folder.id);
          const isFolderSelected = selectedFolderId === folder.id;
          const dropHandlers = makeFolderDropHandlers(folder.id);

          return (
            <div
              key={folder.id}
              {...dropHandlers}
              className="rounded transition-colors"
            >
              <div className="flex items-center group">
                <button
                  onClick={() => onSelectFolder(folder.id)}
                  className={`flex-1 text-left px-3 py-1.5 rounded text-sm font-medium ${
                    isFolderSelected ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  {folder.name}
                </button>
                <button
                  onClick={() => onDeleteFolder(folder.id)}
                  className="opacity-0 group-hover:opacity-100 px-1 text-gray-400 hover:text-red-500 text-xs"
                  title="Delete folder"
                >
                  ×
                </button>
              </div>
              {folderFeeds.map(feed => (
                <DraggableFeed
                  key={feed.id}
                  feed={feed}
                  isSelected={selectedFeedId === feed.id}
                  indented
                  dropIndicator={dragOverFeedId === feed.id ? (dropAbove ? 'above' : 'below') : null}
                  onSelect={() => onSelectFeed(feed.id)}
                  onRemove={() => onRemoveFeed(feed.id)}
                  onRename={(title) => onRenameFeed(feed.id, title)}
                  onUpdateUrl={(url) => onUpdateFeedUrl(feed.id, url)}
                  onDragOverFeed={(above) => { setDragOverFeedId(feed.id); setDropAbove(above); }}
                  onDragLeaveFeed={() => setDragOverFeedId(null)}
                  onDropOnFeed={(draggedId, draggedFolderId, above) => handleFeedDrop(draggedId, draggedFolderId, feed.id, above)}
                />
              ))}
            </div>
          );
        })}

        {/* Unfoldered feeds — drop zone to remove from folder */}
        <div
          {...makeFolderDropHandlers(null)}
          className="rounded transition-colors"
        >
          {folders.length > 0 && unfolderedFeeds.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 my-2" />
          )}
          {unfolderedFeeds.map(feed => (
            <DraggableFeed
              key={feed.id}
              feed={feed}
              isSelected={selectedFeedId === feed.id}
              indented={false}
              dropIndicator={dragOverFeedId === feed.id ? (dropAbove ? 'above' : 'below') : null}
              onSelect={() => onSelectFeed(feed.id)}
              onRemove={() => onRemoveFeed(feed.id)}
              onRename={(title) => onRenameFeed(feed.id, title)}
              onUpdateUrl={(url) => onUpdateFeedUrl(feed.id, url)}
              onDragOverFeed={(above) => { setDragOverFeedId(feed.id); setDropAbove(above); }}
              onDragLeaveFeed={() => setDragOverFeedId(null)}
              onDropOnFeed={(draggedId, draggedFolderId, above) => handleFeedDrop(draggedId, draggedFolderId, feed.id, above)}
            />
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {showAddFeedForm && (
          <form onSubmit={handleAddFeed} className="space-y-2">
            <input
              type="url"
              placeholder="Feed URL..."
              value={feedUrl}
              onChange={e => setFeedUrl(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <select
              value={feedFolderId ?? ''}
              onChange={e => setFeedFolderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <option value="">No folder</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div className="flex gap-1">
              <button type="submit" className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
              <button type="button" onClick={() => onShowAddFeed(false)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
            </div>
          </form>
        )}

        {showAddFolderForm && (
          <form onSubmit={handleAddFolder} className="space-y-2">
            <input
              type="text"
              placeholder="Folder name..."
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-1">
              <button type="submit" className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
              <button type="button" onClick={() => onShowAddFolder(false)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
            </div>
          </form>
        )}

        {!showAddFeedForm && !showAddFolderForm && (
          <div className="flex gap-1">
            <button
              onClick={() => onShowAddFeed(true)}
              className="flex-1 px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              + Feed
            </button>
            <button
              onClick={() => onShowAddFolder(true)}
              className="flex-1 px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              + Folder
            </button>
            <button
              onClick={onRefresh}
              className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              title="Refresh all feeds"
            >
              Refresh
            </button>
            <button
              onClick={onShowSettings}
              className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
              title="Settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
