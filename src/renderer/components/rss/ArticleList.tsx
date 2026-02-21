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
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No articles. Add a feed or refresh to get started.
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
            className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800/50 transition-colors ${
              isSelected
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
            } ${article.isRead ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm leading-snug truncate ${
                  article.isRead ? 'font-normal' : 'font-semibold'
                }`}>
                  {article.isStarred && <span className="text-yellow-500 mr-1">*</span>}
                  {article.title || '(untitled)'}
                </h3>
                {article.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {article.summary}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                {timeAgo(article.publishedAt)}
              </span>
            </div>
            {article.author && (
              <p className="text-xs text-gray-400 mt-1">{article.author}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
