import Redis from "ioredis";

const redisUrl = process.env.QSTASH_REDIS_URL;

if (!redisUrl) {
  console.warn("QSTASH_REDIS_URL is not set. Caching will be disabled.");
}

// Ensure safe execution even if Redis URL is invalid or connection fails
const isUpstash = redisUrl?.includes("upstash.io") || redisUrl?.startsWith("rediss:");

export const redis = redisUrl ? new Redis(redisUrl, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    // Reconnect in the background with backoff, max every 5s
    return Math.min(times * 1000, 5000);
  },
  ...(isUpstash ? { tls: {} } : {})
}) : null;

// The prefix required to isolate this app in the shared Redis database
const PREFIX = "dainiki:";

/**
 * Safely gets a value from Redis and parses it as JSON
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get(`${PREFIX}${key}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`[Redis Get Error for ${key}]:`, err);
    return null;
  }
}

/**
 * Safely sets a value in Redis as JSON with an optional TTL
 */
export async function setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
  if (!redis) return;
  try {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(`${PREFIX}${key}`, data, "EX", ttlSeconds);
    } else {
      await redis.set(`${PREFIX}${key}`, data);
    }
  } catch (err) {
    console.error(`[Redis Set Error for ${key}]:`, err);
  }
}

/**
 * Safely deletes a specific key from Redis
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${PREFIX}${key}`);
  } catch (err) {
    console.error(`[Redis Delete Error for ${key}]:`, err);
  }
}

/**
 * Safely deletes all keys matching a specific pattern (e.g. invalidating a whole user's cache)
 * Pass the pattern WITHOUT the prefix (e.g. "user:1:entries:*")
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    let cursor = "0";
    const fullPattern = `${PREFIX}${pattern}`;
    do {
      const [newCursor, keys] = await redis.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error(`[Redis DeletePattern Error for ${pattern}]:`, err);
  }
}
