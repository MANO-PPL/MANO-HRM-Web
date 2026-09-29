import { onShutdown } from '../../lifecycle/shutdown.js';
import { createRedisClient, closeRedisClient } from '../../config/redis.js';

let cacheRedis;
try {
  cacheRedis = createRedisClient('cache');
} catch (err) {
  console.error('⚠ [Cache] Failed to initialize Redis client:', err);
  cacheRedis = null;
}

// Close the cache connection on shutdown
onShutdown('cache redis', () => closeRedisClient(cacheRedis), 'infra');

// Deletes keys matching a glob pattern with incremental SCAN (KEYS blocks
// Redis while it walks the whole keyspace). In cluster mode each master
// node is scanned for the keys it holds. Keys are deleted one per command in
// a pipeline: a multi-key DEL fails in cluster mode (CROSSSLOT) when the
// keys hash to different slots.
async function deleteMatching(client, pattern) {
  const stream = client.scanStream({ match: pattern, count: 200 });
  for await (const keys of stream) {
    if (keys.length === 0) continue;
    const pipeline = client.pipeline();
    keys.forEach((key) => pipeline.del(key));
    await pipeline.exec();
  }
}

export const cacheService = {
  /**
   * Get parsed JSON value from cache
   */
  async get(key) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return null;
    try {
      const data = await cacheRedis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`[Cache] Get error for key "${key}":`, err);
      return null; // Fallback to DB query
    }
  },

  /**
   * Set JSON value in cache with a TTL (defaults to 24 hours)
   */
  async set(key, value, ttl = 86400) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return;
    try {
      await cacheRedis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      console.error(`[Cache] Set error for key "${key}":`, err);
    }
  },

  /**
   * Delete a key from cache (invalidation)
   */
  async del(key) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return;
    try {
      await cacheRedis.del(key);
      console.log(`🧹 [Cache] Invalidated cache key "${key}"`);
    } catch (err) {
      console.error(`[Cache] Delete error for key "${key}":`, err);
    }
  },

  /**
   * Delete keys matching pattern
   */
  async delPattern(pattern) {
    if (!cacheRedis || cacheRedis.status !== 'ready') return;
    try {
      const clients = typeof cacheRedis.nodes === 'function' ? cacheRedis.nodes('master') : [cacheRedis];
      await Promise.all(clients.map((client) => deleteMatching(client, pattern)));
      console.log(`🧹 [Cache] Invalidated keys matching "${pattern}"`);
    } catch (err) {
      console.error(`[Cache] Delete pattern error for "${pattern}":`, err);
    }
  },

  /**
   * Invalidate keys matching pattern (alias for delPattern)
   */
  async invalidatePattern(pattern) {
    return this.delPattern(pattern);
  }
};

export const invalidateCachePattern = (pattern) => cacheService.delPattern(pattern);
export const invalidatePattern = (pattern) => cacheService.delPattern(pattern);

