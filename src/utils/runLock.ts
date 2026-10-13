/**
 * Heartbeat-based run lock stored in Durable Object storage.
 *
 * Prevents overlapping scheduled runs (e.g. a 200-repo analysis batch that
 * outlasts the 30-minute cron, or two crons firing at the same minute).
 * A lock whose heartbeat is older than `staleMs` is treated as abandoned
 * (the run crashed or was evicted) and can be taken over.
 */

/** Subset of DurableObjectStorage used by the lock (easy to fake in tests). */
export interface LockStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface LockRecord {
  acquiredAt: number;
  heartbeatAt: number;
}

/** Try to take the lock. Returns false if a live (non-stale) holder exists. */
export async function tryAcquireLock(
  storage: LockStorage,
  key: string,
  staleMs: number,
  now: number = Date.now(),
): Promise<boolean> {
  const existing = await storage.get<LockRecord>(key);
  if (existing && now - existing.heartbeatAt < staleMs) {
    return false;
  }
  await storage.put<LockRecord>(key, { acquiredAt: now, heartbeatAt: now });
  return true;
}

/** Refresh the heartbeat of a held lock. No-op if the lock isn't held. */
export async function heartbeatLock(
  storage: LockStorage,
  key: string,
  now: number = Date.now(),
): Promise<void> {
  const existing = await storage.get<LockRecord>(key);
  if (!existing) return;
  await storage.put<LockRecord>(key, { ...existing, heartbeatAt: now });
}

export async function releaseLock(
  storage: LockStorage,
  key: string,
): Promise<void> {
  await storage.delete(key);
}
