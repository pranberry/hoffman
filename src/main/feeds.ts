import Parser from 'rss-parser';
import { getDb } from './database';
import type { Feed, Article, Folder } from '../shared/types';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'PrivateNewsReader/1.0',
  },
});

// ── Folder operations ──

export function listFolders(): Folder[] {
  const db = getDb();
  return db.prepare('SELECT id, name, position FROM folders ORDER BY position ASC, id ASC').all() as Folder[];
}

export function createFolder(name: string): Folder {
  const db = getDb();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next FROM folders').get() as { next: number };
  const result = db.prepare('INSERT INTO folders (name, position) VALUES (?, ?)').run(name, maxPos.next);
  return { id: Number(result.lastInsertRowid), name, position: maxPos.next };
}

export function renameFolder(id: number, name: string): Folder {
  const db = getDb();
  db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id);
  return db.prepare('SELECT id, name, position FROM folders WHERE id = ?').get(id) as Folder;
}

export function deleteFolder(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
}

// ── Feed operations ──

function rowToFeed(row: Record<string, unknown>): Feed {
  return {
    id: row.id as number,
    url: row.url as string,
    title: row.title as string,
    description: row.description as string,
    siteUrl: row.site_url as string,
    folderId: row.folder_id as number | null,
    lastFetchedAt: row.last_fetched_at as string | null,
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
  };
}

export function listFeeds(): Feed[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM feeds ORDER BY title ASC').all() as Record<string, unknown>[];
  return rows.map(rowToFeed);
}

export async function addFeed(url: string, folderId: number | null): Promise<Feed> {
  const db = getDb();

  // Fetch the feed to get metadata
  let feedData: Parser.Output<Record<string, unknown>>;
  try {
    feedData = await parser.parseURL(url);
  } catch (err) {
    throw new Error(`Failed to fetch feed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const title = feedData.title || url;
  const description = feedData.description || '';
  const siteUrl = feedData.link || '';

  const result = db.prepare(
    'INSERT INTO feeds (url, title, description, site_url, folder_id) VALUES (?, ?, ?, ?, ?)'
  ).run(url, title, description, siteUrl, folderId);

  const feedId = Number(result.lastInsertRowid);
  const feed = rowToFeed(
    db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId) as Record<string, unknown>
  );

  // Insert initial articles
  insertArticles(feedId, feedData.items || []);

  // Update last fetched
  db.prepare('UPDATE feeds SET last_fetched_at = datetime(\'now\'), error_message = NULL WHERE id = ?').run(feedId);

  return feed;
}

export function removeFeed(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM feeds WHERE id = ?').run(id);
}

export function moveFeed(id: number, folderId: number | null): void {
  const db = getDb();
  db.prepare('UPDATE feeds SET folder_id = ? WHERE id = ?').run(folderId, id);
}

// ── Article operations ──

function rowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as number,
    feedId: row.feed_id as number,
    guid: row.guid as string,
    title: row.title as string,
    link: row.link as string,
    author: row.author as string,
    summary: row.summary as string,
    content: row.content as string,
    publishedAt: row.published_at as string,
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    fetchedAt: row.fetched_at as string,
  };
}

function insertArticles(feedId: number, items: Parser.Item[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO articles (feed_id, guid, title, link, author, summary, content, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((articles: Parser.Item[]) => {
    for (const item of articles) {
      const guid = item.guid || item.link || item.title || '';
      const itemAny = item as Record<string, unknown>;
      stmt.run(
        feedId,
        guid,
        item.title || '',
        item.link || '',
        item.creator || (itemAny.author as string) || '',
        item.contentSnippet || item.summary || '',
        item.content || (itemAny['content:encoded'] as string) || '',
        item.isoDate || item.pubDate || new Date().toISOString()
      );
    }
  });

  insertMany(items);
}

export async function refreshFeed(feedId: number): Promise<Article[]> {
  const db = getDb();
  const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId) as Record<string, unknown> | undefined;
  if (!feed) throw new Error(`Feed not found: ${feedId}`);

  try {
    const feedData = await parser.parseURL(feed.url as string);

    // Update feed metadata
    db.prepare(
      'UPDATE feeds SET title = ?, description = ?, site_url = ?, last_fetched_at = datetime(\'now\'), error_message = NULL WHERE id = ?'
    ).run(feedData.title || feed.url, feedData.description || '', feedData.link || '', feedId);

    insertArticles(feedId, feedData.items || []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE feeds SET error_message = ? WHERE id = ?').run(msg, feedId);
  }

  return listArticles(feedId);
}

export async function refreshAllFeeds(): Promise<Article[]> {
  const feeds = listFeeds();
  const results = await Promise.allSettled(feeds.map(f => refreshFeed(f.id)));
  // Flatten all successfully fetched articles
  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }
  return articles;
}

export function listArticles(feedId?: number, folderId?: number): Article[] {
  const db = getDb();
  let query = 'SELECT a.* FROM articles a';
  const params: unknown[] = [];

  if (folderId !== undefined) {
    query += ' JOIN feeds f ON a.feed_id = f.id WHERE f.folder_id = ?';
    params.push(folderId);
  } else if (feedId !== undefined) {
    query += ' WHERE a.feed_id = ?';
    params.push(feedId);
  }

  query += ' ORDER BY a.published_at DESC';

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map(rowToArticle);
}

export function getArticle(id: number): Article | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToArticle(row) : null;
}

export function markArticleRead(id: number, isRead: boolean): void {
  const db = getDb();
  db.prepare('UPDATE articles SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, id);
}

export function markAllRead(feedId?: number): void {
  const db = getDb();
  if (feedId !== undefined) {
    db.prepare('UPDATE articles SET is_read = 1 WHERE feed_id = ?').run(feedId);
  } else {
    db.prepare('UPDATE articles SET is_read = 1').run();
  }
}

export function toggleStar(id: number): Article {
  const db = getDb();
  db.prepare('UPDATE articles SET is_starred = CASE WHEN is_starred = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
  return getArticle(id)!;
}

export function listStarredArticles(): Article[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM articles WHERE is_starred = 1 ORDER BY published_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToArticle);
}
