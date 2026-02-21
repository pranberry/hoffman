import React from 'react';
import type { Article } from '../../../shared/types';

interface ArticleListProps {
  articles: Article[];
  selectedArticleId: number | null;
  onSelectArticle: (id: number) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

export function ArticleList({ articles, selectedArticleId, onSelectArticle }: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
        No articles yet. Add a feed or hit refresh.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {articles.map(article => {
        const isSelected = article.id === selectedArticleId;
        return (
          <button
            key={article.id}
            onClick={() => onSelectArticle(article.id)}
            data-article-id={article.id}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800/50 transition-colors block ${
              isSelected
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            } ${article.isRead ? 'opacity-60' : ''}`}
          >
            {/* Title row — wraps instead of truncating */}
            <div className={`text-[13px] leading-snug mb-1 ${
              article.isRead ? 'font-normal' : 'font-semibold'
            }`} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {article.isStarred && <span className="text-yellow-500 mr-1">*</span>}
              {article.title || '(untitled)'}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              {article.author && (
                <span className="truncate max-w-[120px]">{article.author}</span>
              )}
              <span className="flex-shrink-0">{timeAgo(article.publishedAt)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
