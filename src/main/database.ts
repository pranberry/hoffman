import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

/**
 * ── ARCHITECTURAL OVERVIEW: DATA PERSISTENCE ──
 * This app uses SQLite via 'better-sqlite3' for local-first data storage.
 * - ZERO Telemetry: All data stays on the user's machine.
 * - Performance: We use WAL (Write-Ahead Logging) for high-performance concurrent access.
 * - Lifecycle: Database is initialized in the Main process and persists in the 'userData' folder.
 */

let db: Database.Database;

/** Returns the active database instance. Ensures singleton access. */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/** Initializes the SQLite connection and runs migrations. */
export function initDatabase(dbPath?: string): void {
  // Determine database location (platform-specific userData folder)
  const finalPath = dbPath || path.join(app.getPath('userData'), 'hoffman-reader.db');
  db = new Database(finalPath);

  // WAL mode allows multiple readers and one writer to work simultaneously without locking.
  if (finalPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  
  // Enforce data integrity
  db.pragma('foreign_keys = ON');

  createTables();
  runMigrations();
}

/** Defines the relational schema. */
function createTables(): void {
  db.exec(`
    /* Folders for grouping RSS feeds */
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    /* RSS Feed metadata and sync state */
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      site_url TEXT NOT NULL DEFAULT '',
      folder_id INTEGER,
      last_fetched_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    /* Individual articles. Unique constraint on (feed_id, guid) prevents duplicates. */
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_id INTEGER NOT NULL,
      guid TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
      UNIQUE(feed_id, guid)
    );

    /* Stock groups for organizing watchlist entries */
    CREATE TABLE IF NOT EXISTS stock_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    /* Stock watchlist symbols */
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      group_id INTEGER,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES stock_groups(id) ON DELETE SET NULL
    );

    /* Key-value store for app configuration */
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    /* Seed default configuration on first boot */
    INSERT OR IGNORE INTO settings (key, value) VALUES ('refresh_interval', '300'); -- 5 minutes in seconds

    /* Performance Indexes for fast article filtering and sorting */
    CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
    CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
    CREATE INDEX IF NOT EXISTS idx_articles_is_starred ON articles(is_starred);
    CREATE INDEX IF NOT EXISTS idx_feeds_folder_id ON feeds(folder_id);
  `);
}

/** Handles schema changes that need to survive existing databases. */
function runMigrations(): void {
  const feedCols = db.prepare('PRAGMA table_info(feeds)').all() as { name: string }[];
  if (!feedCols.find(c => c.name === 'position')) {
    db.exec('ALTER TABLE feeds ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
  }

  const watchlistCols = db.prepare('PRAGMA table_info(watchlist)').all() as { name: string }[];
  if (!watchlistCols.find(c => c.name === 'group_id')) {
    db.exec('ALTER TABLE watchlist ADD COLUMN group_id INTEGER');
  }
}

/** Safe shutdown of the database connection. */
export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
