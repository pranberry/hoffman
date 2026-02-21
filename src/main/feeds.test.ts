import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import './test-setup';
import { initDatabase, closeDatabase } from './database';
import { addFeed, removeFeed, listFeeds } from './feeds';

describe('Feeds Logic', () => {
  beforeAll(() => {
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  it('should add a feed successfully', async () => {
    const url = 'https://www.aier.org/feed/';
    const feed = await addFeed(url, null);
    
    expect(feed.url).toBe(url);
    expect(feed.title).toBeDefined();
    
    const feeds = listFeeds();
    expect(feeds.some(f => f.url === url)).toBe(true);
  }, 40000);

  it('should remove a feed successfully', async () => {
    const feedsBefore = listFeeds();
    const feedToDelete = feedsBefore[0];
    if (feedToDelete) {
      removeFeed(feedToDelete.id);
      const feedsAfter = listFeeds();
      expect(feedsAfter.some(f => f.id === feedToDelete.id)).toBe(false);
    }
  });
});
