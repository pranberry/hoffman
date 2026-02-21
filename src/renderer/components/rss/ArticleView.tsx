import React from 'react';
import type { Article } from '../../../shared/types';

interface ArticleViewProps {
  article: Article | null;
  onToggleStar: (id: number) => void;
  onOpenInBrowser: (url: string) => void;
}

export function ArticleView({ article, onToggleStar, onOpenInBrowser }: ArticleViewProps) {
  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select an article to read
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold leading-tight mb-2">{article.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {article.author && <span>{article.author}</span>}
            {article.publishedAt && (
              <time>{new Date(article.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}</time>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onToggleStar(article.id)}
              className={`px-2 py-1 text-xs rounded ${
                article.isStarred
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {article.isStarred ? 'Starred' : 'Star'}
            </button>
            {article.link && (
              <button
                onClick={() => onOpenInBrowser(article.link)}
                className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Open in Browser
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className="article-content text-sm"
          dangerouslySetInnerHTML={{ __html: article.content || article.summary || '<p>No content available.</p>' }}
        />
      </div>
    </div>
  );
}
