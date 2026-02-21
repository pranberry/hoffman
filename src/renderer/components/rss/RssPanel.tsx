import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Folder, Feed, Article } from '../../../shared/types';
import { Sidebar } from './Sidebar';
import { ArticleList } from './ArticleList';
import { ArticleView } from './ArticleView';
import { Spinner } from '../common/Spinner';
import { useResizable } from '../../hooks/useResizable';

export function RssPanel() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [showStarred, setShowStarred] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const sidebar = useResizable({ initialWidth: 220, minWidth: 140, maxWidth: 360, storageKey: 'sidebar-width' });
  const articleList = useResizable({ initialWidth: 300, minWidth: 200, maxWidth: 600, storageKey: 'articlelist-width' });

  const articlesRef = useRef(articles);
  const selectedIndexRef = useRef(selectedArticleIndex);
  articlesRef.current = articles;
  selectedIndexRef.current = selectedArticleIndex;

  // Load folders and feeds on mount
  const loadSidebar = useCallback(async () => {
    const [f, fe] = await Promise.all([
      window.api.folders.list(),
      window.api.feeds.list(),
    ]);
    setFolders(f);
    setFeeds(fe);
  }, []);

  useEffect(() => { loadSidebar(); }, [loadSidebar]);

  // Load articles when selection changes
  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      let arts: Article[];
      if (showStarred) {
        arts = await window.api.articles.starred();
      } else {
        arts = await window.api.articles.list(
          selectedFeedId ?? undefined,
          selectedFolderId ?? undefined
        );
      }
      setArticles(arts);
      setSelectedArticle(null);
      setSelectedArticleIndex(-1);
    } finally {
      setLoading(false);
    }
  }, [selectedFeedId, selectedFolderId, showStarred]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      window.api.feeds.refresh().then(() => loadArticles());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadArticles]);

  const selectArticle = useCallback(async (id: number) => {
    const article = await window.api.articles.get(id);
    if (article) {
      setSelectedArticle(article);
      const idx = articlesRef.current.findIndex(a => a.id === id);
      setSelectedArticleIndex(idx);
      if (!article.isRead) {
        await window.api.articles.markRead(id, true);
        setArticles(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
      }
    }
  }, []);

  const handleToggleStar = useCallback(async (id: number) => {
    const updated = await window.api.articles.toggleStar(id);
    setSelectedArticle(prev => prev?.id === id ? updated : prev);
    setArticles(prev => prev.map(a => a.id === id ? updated : a));
  }, []);

  const handleOpenInBrowser = useCallback((url: string) => {
    window.api.shell.openExternal(url);
  }, []);

  const handleAddFeed = useCallback(async (url: string, folderId: number | null) => {
    await window.api.feeds.add(url, folderId);
    await loadSidebar();
    await loadArticles();
  }, [loadSidebar, loadArticles]);

  const handleRemoveFeed = useCallback(async (id: number) => {
    await window.api.feeds.remove(id);
    if (selectedFeedId === id) setSelectedFeedId(null);
    await loadSidebar();
    await loadArticles();
  }, [selectedFeedId, loadSidebar, loadArticles]);

  const handleAddFolder = useCallback(async (name: string) => {
    await window.api.folders.create(name);
    await loadSidebar();
  }, [loadSidebar]);

  const handleDeleteFolder = useCallback(async (id: number) => {
    await window.api.folders.delete(id);
    if (selectedFolderId === id) setSelectedFolderId(null);
    await loadSidebar();
  }, [selectedFolderId, loadSidebar]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      await window.api.feeds.refresh();
      await loadSidebar();
      await loadArticles();
    } finally {
      setLoading(false);
    }
  }, [loadSidebar, loadArticles]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      const arts = articlesRef.current;
      const idx = selectedIndexRef.current;

      switch (e.key) {
        case 'j': {
          const next = Math.min(idx + 1, arts.length - 1);
          if (next >= 0 && arts[next]) {
            selectArticle(arts[next].id);
            const el = document.querySelector(`[data-article-id="${arts[next].id}"]`);
            el?.scrollIntoView({ block: 'nearest' });
          }
          break;
        }
        case 'k': {
          const prev = Math.max(idx - 1, 0);
          if (prev >= 0 && arts[prev]) {
            selectArticle(arts[prev].id);
            const el = document.querySelector(`[data-article-id="${arts[prev].id}"]`);
            el?.scrollIntoView({ block: 'nearest' });
          }
          break;
        }
        case 'o': {
          const current = idx >= 0 ? arts[idx] : null;
          if (current?.link) handleOpenInBrowser(current.link);
          break;
        }
        case 'r': {
          handleRefresh();
          break;
        }
        case 's': {
          const current = idx >= 0 ? arts[idx] : null;
          if (current) handleToggleStar(current.id);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectArticle, handleOpenInBrowser, handleRefresh, handleToggleStar]);

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {/* Sidebar — resizable */}
      <div style={{ width: sidebar.width, flexShrink: 0 }} className="border-r border-gray-200 dark:border-gray-800 flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar
          folders={folders}
          feeds={feeds}
          selectedFeedId={selectedFeedId}
          selectedFolderId={selectedFolderId}
          showStarred={showStarred}
          onSelectFeed={(id) => { setSelectedFeedId(id); setSelectedFolderId(null); setShowStarred(false); }}
          onSelectFolder={(id) => { setSelectedFolderId(id); setSelectedFeedId(null); setShowStarred(false); }}
          onSelectStarred={() => { setShowStarred(true); setSelectedFeedId(null); setSelectedFolderId(null); }}
          onSelectAll={() => { setSelectedFeedId(null); setSelectedFolderId(null); setShowStarred(false); }}
          onAddFeed={handleAddFeed}
          onRemoveFeed={handleRemoveFeed}
          onAddFolder={handleAddFolder}
          onDeleteFolder={handleDeleteFolder}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Resize handle: sidebar ↔ article list */}
      <div className="resize-handle" onMouseDown={sidebar.onMouseDown} />

      {/* Article list — resizable */}
      <div style={{ width: articleList.width, flexShrink: 0 }} className="border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        <div className="titlebar-drag h-12 flex items-end px-4 pb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider titlebar-no-drag">
            {loading && <Spinner size="sm" />}
            {!loading && `${articles.length} articles`}
          </span>
        </div>
        <ArticleList
          articles={articles}
          selectedArticleId={selectedArticle?.id ?? null}
          onSelectArticle={selectArticle}
        />
      </div>

      {/* Resize handle: article list ↔ article view */}
      <div className="resize-handle" onMouseDown={articleList.onMouseDown} />

      {/* Article view — fills remaining space */}
      <ArticleView
        article={selectedArticle}
        onToggleStar={handleToggleStar}
        onOpenInBrowser={handleOpenInBrowser}
      />
    </div>
  );
}
