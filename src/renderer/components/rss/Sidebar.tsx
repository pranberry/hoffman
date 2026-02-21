import React, { useState } from 'react';
import type { Folder, Feed } from '../../../shared/types';

interface SidebarProps {
  folders: Folder[];
  feeds: Feed[];
  selectedFeedId: number | null;
  selectedFolderId: number | null;
  showStarred: boolean;
  onSelectFeed: (feedId: number | null) => void;
  onSelectFolder: (folderId: number | null) => void;
  onSelectStarred: () => void;
  onSelectAll: () => void;
  onAddFeed: (url: string, folderId: number | null) => void;
  onRemoveFeed: (id: number) => void;
  onAddFolder: (name: string) => void;
  onDeleteFolder: (id: number) => void;
  onRefresh: () => void;
}

export function Sidebar({
  folders, feeds, selectedFeedId, selectedFolderId, showStarred,
  onSelectFeed, onSelectFolder, onSelectStarred, onSelectAll,
  onAddFeed, onRemoveFeed, onAddFolder, onDeleteFolder, onRefresh,
}: SidebarProps) {
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedFolderId, setFeedFolderId] = useState<number | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleAddFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedUrl.trim()) {
      onAddFeed(feedUrl.trim(), feedFolderId);
      setFeedUrl('');
      setShowAddFeed(false);
    }
  };

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onAddFolder(folderName.trim());
      setFolderName('');
      setShowAddFolder(false);
    }
  };

  const unfolderedFeeds = feeds.filter(f => f.folderId === null);
  const isAllSelected = !selectedFeedId && !selectedFolderId && !showStarred;

  return (
    <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full bg-gray-50 dark:bg-gray-900">
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

        {/* Folders */}
        {folders.map(folder => {
          const folderFeeds = feeds.filter(f => f.folderId === folder.id);
          const isFolderSelected = selectedFolderId === folder.id;

          return (
            <div key={folder.id}>
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
                  x
                </button>
              </div>
              {folderFeeds.map(feed => (
                <div key={feed.id} className="flex items-center group">
                  <button
                    onClick={() => onSelectFeed(feed.id)}
                    className={`flex-1 text-left pl-6 pr-3 py-1 rounded text-sm truncate ${
                      selectedFeedId === feed.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {feed.title || feed.url}
                    {feed.errorMessage && <span className="ml-1 text-red-400" title={feed.errorMessage}>!</span>}
                  </button>
                  <button
                    onClick={() => onRemoveFeed(feed.id)}
                    className="opacity-0 group-hover:opacity-100 px-1 text-gray-400 hover:text-red-500 text-xs"
                    title="Remove feed"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          );
        })}

        {/* Unfoldered feeds */}
        {unfolderedFeeds.map(feed => (
          <div key={feed.id} className="flex items-center group">
            <button
              onClick={() => onSelectFeed(feed.id)}
              className={`flex-1 text-left px-3 py-1.5 rounded text-sm truncate ${
                selectedFeedId === feed.id ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {feed.title || feed.url}
              {feed.errorMessage && <span className="ml-1 text-red-400" title={feed.errorMessage}>!</span>}
            </button>
            <button
              onClick={() => onRemoveFeed(feed.id)}
              className="opacity-0 group-hover:opacity-100 px-1 text-gray-400 hover:text-red-500 text-xs"
              title="Remove feed"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {showAddFeed && (
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
              <button type="button" onClick={() => setShowAddFeed(false)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
            </div>
          </form>
        )}

        {showAddFolder && (
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
              <button type="button" onClick={() => setShowAddFolder(false)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
            </div>
          </form>
        )}

        {!showAddFeed && !showAddFolder && (
          <div className="flex gap-1">
            <button
              onClick={() => setShowAddFeed(true)}
              className="flex-1 px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
            >
              + Feed
            </button>
            <button
              onClick={() => setShowAddFolder(true)}
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
          </div>
        )}
      </div>
    </div>
  );
}
