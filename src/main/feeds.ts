import { XMLParser } from 'fast-xml-parser';
import { getDb } from './database';
import type { Feed, Article, Folder } from '../shared/types';

// Use a realistic browser User-Agent — many RSS servers (Akamai, Cloudflare)
// block requests with bot-like UAs. This won't bypass full bot detection
// (e.g. Akamai Ghost) but handles simple UA checks.
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Force these tags to always be arrays so we never get a single-object vs array mismatch
  isArray: (name) => ['item', 'entry', 'link'].includes(name),
  cdataPropName: '__cdata',
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

// ── Internal feed types (not exposed outside this module) ──

interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  items: ParsedItem[];
}

interface ParsedItem {
  guid: string;
  title: string;
  link: string;
  creator: string;
  contentSnippet: string;
  content: string;
  isoDate: string;
}

// ── XML value helpers ──

/** Coerces any fast-xml-parser value (string, number, CDATA object, #text object) to a plain string. */
function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if ('__cdata' in obj) return str(obj['__cdata']);
    if ('#text' in obj) return str(obj['#text']);
  }
  return '';
}

/** Parses a date string into an ISO 8601 string, returning '' on failure. */
function toIso(v: unknown): string {
  const s = str(v);
  if (!s) return '';
  try { return new Date(s).toISOString(); } catch { return ''; }
}

// ── RSS 2.0 parser ──

function parseRssChannel(channel: Record<string, unknown>): ParsedFeed {
  // <link> in RSS is a bare text node, but isArray forces it into an array
  const rawLink = channel.link as unknown[] | undefined;
  const siteLink = rawLink ? str(rawLink[0]) : '';

  const rawItems = (channel.item as unknown[]) ?? [];
  const items = rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const description = str(item.description);
    const contentEncoded = str(item['content:encoded']);
    const title = str(item.title);
    const link = str(Array.isArray(item.link) ? (item.link as unknown[])[0] : item.link);
    const guid = str(item.guid) || link || title;
    const creator = str(item['dc:creator']) || str(item.author);
    const content = contentEncoded || description;
    const contentSnippet = description.replace(/<[^>]*>/g, '').slice(0, 500);
    const isoDate = toIso(item.pubDate) || toIso(item['dc:date']);
    return { guid, title, link, creator, contentSnippet, content, isoDate };
  });

  return {
    title: str(channel.title),
    description: str(channel.description),
    link: siteLink,
    items,
  };
}

// ── Atom parser ──

function parseAtomFeed(feed: Record<string, unknown>): ParsedFeed {
  // <link> in Atom is an element with an href attribute
  const feedLinks = (feed.link as unknown[]) ?? [];
  let siteLink = '';
  for (const l of feedLinks) {
    const obj = l as Record<string, unknown>;
    if (!obj['@_rel'] || obj['@_rel'] === 'alternate') {
      siteLink = str(obj['@_href']);
      break;
    }
  }

  const entries = (feed.entry as unknown[]) ?? [];
  const items = entries.map((raw) => {
    const entry = raw as Record<string, unknown>;

    const entryLinks = (entry.link as unknown[]) ?? [];
    let link = '';
    for (const l of entryLinks) {
      const obj = l as Record<string, unknown>;
      if (!obj['@_rel'] || obj['@_rel'] === 'alternate') {
        link = str(obj['@_href']);
        break;
      }
    }

    const title = str(entry.title);
    const guid = str(entry.id) || link || title;
    const authorObj = entry.author as Record<string, unknown> | undefined;
    const creator = authorObj ? str(authorObj.name) : '';
    const summary = str(entry.summary);
    const content = str(entry.content);
    const contentSnippet = (summary || content).replace(/<[^>]*>/g, '').slice(0, 500);
    const isoDate = toIso(entry.updated) || toIso(entry.published);

    return { guid, title, link, creator, contentSnippet, content: content || summary, isoDate };
  });

  return {
    title: str(feed.title),
    description: str(feed.subtitle ?? feed.description),
    link: siteLink,
    items,
  };
}

// ── Fetch + parse ──

async function fetchAndParseFeed(url: string): Promise<ParsedFeed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(`403 Forbidden — this feed's server blocks automated requests. You may need to find an alternative RSS URL for this source.`);
    }
    throw new Error(`Failed to fetch feed: HTTP ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const doc = xmlParser.parse(xml) as Record<string, unknown>;

  if (doc.rss) {
    const rss = doc.rss as Record<string, unknown>;
    return parseRssChannel(rss.channel as Record<string, unknown>);
  }
  if (doc.feed) {
    return parseAtomFeed(doc.feed as Record<string, unknown>);
  }
  throw new Error('Unrecognized feed format (expected RSS 2.0 or Atom)');
}

// ── URL validation ──

function validateFeedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid feed URL: "${url}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Feed URLs must use http or https (got "${parsed.protocol}")`);
  }
}

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

export function reorderFolders(ids: number[]): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE folders SET position = ? WHERE id = ?');
  const updateAll = db.transaction((orderedIds: number[]) => {
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, orderedIds[i]);
    }
  });
  updateAll(ids);
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
    position: (row.position as number) ?? 0,
    lastFetchedAt: row.last_fetched_at as string | null,
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
  };
}

export function listFeeds(): Feed[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM feeds ORDER BY position ASC, id ASC').all() as Record<string, unknown>[];
  return rows.map(rowToFeed);
}

export async function addFeed(url: string, folderId: number | null): Promise<Feed> {
  validateFeedUrl(url);

  const db = getDb();

  let feedData: ParsedFeed;
  try {
    feedData = await fetchAndParseFeed(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch feed: ${msg}`);
  }

  const title = feedData.title || url;
  const description = feedData.description || '';
  const siteUrl = feedData.link || '';

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next FROM feeds').get() as { next: number };
  const result = db.prepare(
    'INSERT INTO feeds (url, title, description, site_url, folder_id, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(url, title, description, siteUrl, folderId, maxPos.next);

  const feedId = Number(result.lastInsertRowid);
  const feed = rowToFeed(
    db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId) as Record<string, unknown>
  );

  insertArticles(feedId, feedData.items);

  db.prepare('UPDATE feeds SET last_fetched_at = datetime(\'now\'), error_message = NULL WHERE id = ?').run(feedId);

  return feed;
}

export function removeFeed(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM feeds WHERE id = ?').run(id);
}

export function renameFeed(id: number, title: string): Feed {
  const db = getDb();
  db.prepare('UPDATE feeds SET title = ? WHERE id = ?').run(title, id);
  return rowToFeed(db.prepare('SELECT * FROM feeds WHERE id = ?').get(id) as Record<string, unknown>);
}

export function updateFeedUrl(id: number, url: string): Feed {
  validateFeedUrl(url);
  const db = getDb();
  db.prepare('UPDATE feeds SET url = ? WHERE id = ?').run(url, id);
  return rowToFeed(db.prepare('SELECT * FROM feeds WHERE id = ?').get(id) as Record<string, unknown>);
}

export function moveFeed(id: number, folderId: number | null): void {
  const db = getDb();
  db.prepare('UPDATE feeds SET folder_id = ? WHERE id = ?').run(folderId, id);
}

export function reorderFeeds(ids: number[]): void {
  const db = getDb();
  const update = db.prepare('UPDATE feeds SET position = ? WHERE id = ?');
  const reorder = db.transaction((orderedIds: number[]) => {
    orderedIds.forEach((id, i) => update.run(i, id));
  });
  reorder(ids);
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

function insertArticles(feedId: number, items: ParsedItem[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO articles (feed_id, guid, title, link, author, summary, content, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((articles: ParsedItem[]) => {
    for (const item of articles) {
      stmt.run(
        feedId,
        item.guid,
        item.title,
        item.link,
        item.creator,
        item.contentSnippet,
        item.content,
        item.isoDate || new Date().toISOString()
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
    const feedData = await fetchAndParseFeed(feed.url as string);

    db.prepare(
      'UPDATE feeds SET description = ?, site_url = ?, last_fetched_at = datetime(\'now\'), error_message = NULL WHERE id = ?'
    ).run(feedData.description || '', feedData.link || '', feedId);

    insertArticles(feedId, feedData.items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE feeds SET error_message = ? WHERE id = ?').run(msg, feedId);
  }

  return listArticles(feedId);
}

export async function refreshAllFeeds(): Promise<Article[]> {
  const feeds = listFeeds();
  const results = await Promise.allSettled(feeds.map(f => refreshFeed(f.id)));
  const articles: Article[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value);
    }
  }
  return articles;
}

export function listArticles(feedId?: number, folderId?: number, limit?: number): Article[] {
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

  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }

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
