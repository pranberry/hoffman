import { getDb } from './database';

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function listSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, string>);
}
