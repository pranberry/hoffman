import React from 'react';
import type { Article } from '../../../shared/types';

interface ArticleViewProps {
  article: Article | null;
  onToggleStar: (id: number) => void;
  onOpenInBrowser: (url: string) => void;
}

/**
 * Heuristic: if content is very short or looks like just a summary,
 * warn the user they should read the full article in the browser.
 */
function isContentTruncated(article: Article): boolean {
  const content = article.content || '';
  const summary = article.summary || '';

  // No content at all
  if (!content && !summary) return true;

  // Content is same as summary (feed only provides summary)
  if (content && summary && content.trim() === summary.trim()) return true;

  // Content is very short (< 200 chars of text after stripping HTML)
  const textOnly = (content || summary).replace(/<[^>]*>/g, '').trim();
  if (textOnly.length < 200 && article.link) return true;

  return false;
}

export function ArticleView({ article, onToggleStar, onOpenInBrowser }: ArticleViewProps) {
  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select an article to read
      </div>
    );
  }

  const truncated = isContentTruncated(article);
  const displayContent = article.content || article.summary || '';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold leading-tight mb-3">{article.title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
            {article.author && <span>{article.author}</span>}
            {article.publishedAt && (
              <time>{new Date(article.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}</time>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleStar(article.id)}
              className={`px-3 py-1.5 text-xs rounded font-medium ${
                article.isStarred
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {article.isStarred ? 'Starred' : 'Star'}
            </button>
            {article.link && (
              <button
                onClick={() => onOpenInBrowser(article.link)}
                className="px-3 py-1.5 text-xs rounded font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Open in Browser
              </button>
            )}
          </div>
        </div>

        {/* Truncation warning */}
        {truncated && article.link && (
          <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              This feed only provides a summary. {' '}
              <button
                onClick={() => onOpenInBrowser(article.link)}
                className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
              >
                Read the full article in your browser.
              </button>
            </p>
          </div>
        )}

        {/* Content */}
        {displayContent ? (
          <div
            className="article-content text-sm"
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
        ) : (
          <p className="text-gray-400 text-sm italic">
            No content available for this article.
            {article.link && (
              <>
                {' '}
                <button
                  onClick={() => onOpenInBrowser(article.link)}
                  className="underline"
                >
                  Open in browser
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
