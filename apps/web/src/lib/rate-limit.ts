import { lt, sql } from 'drizzle-orm';
import { AppError } from '@earnchat/core';
import { getDb, rateLimitCounters } from '@earnchat/db';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function clientAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function enforceInMemory(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    throw new AppError('Too many attempts. Please try again later.', 429, 'rate_limited');
  }
  bucket.count += 1;
}

function maybeCleanupExpiredCounters(): void {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  void getDb()
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.resetAt, new Date(now - 24 * 60 * 60 * 1000)))
    .catch((error) => console.error('Rate limiter cleanup failed:', error));
}

/**
 * Atomically increments a fixed-window counter and throws a 429 AppError when
 * the caller exceeds `limit` within `windowMs`. Counters live in Postgres so the
 * limit is enforced across every instance; an in-memory map is used as a
 * fallback when the database is unavailable. Pass `identifier` (e.g. a user id)
 * for authenticated routes so the limit is per-account rather than per-IP.
 */
export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
  identifier?: string
): Promise<void> {
  const key = `${scope}:${identifier ?? clientAddress(request)}`;

  if (process.env.DATABASE_URL) {
    try {
      const window = sql`(${windowMs} * interval '1 millisecond')`;
      const [row] = await getDb()
        .insert(rateLimitCounters)
        .values({ key, count: 1, resetAt: sql`now() + ${window}` })
        .onConflictDoUpdate({
          target: rateLimitCounters.key,
          set: {
            count: sql`case when ${rateLimitCounters.resetAt} <= now() then 1 else ${rateLimitCounters.count} + 1 end`,
            resetAt: sql`case when ${rateLimitCounters.resetAt} <= now() then now() + ${window} else ${rateLimitCounters.resetAt} end`
          }
        })
        .returning({ count: rateLimitCounters.count });

      if (Number(row?.count ?? 1) > limit) {
        throw new AppError('Too many attempts. Please try again later.', 429, 'rate_limited');
      }
      maybeCleanupExpiredCounters();
      return;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Rate limiter database error, falling back to in-memory:', error);
    }
  }

  enforceInMemory(key, limit, windowMs);
}
