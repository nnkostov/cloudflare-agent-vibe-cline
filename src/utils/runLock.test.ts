import { describe, it, expect, beforeEach } from "vitest";
import {
  tryAcquireLock,
  heartbeatLock,
  releaseLock,
  type LockStorage,
  type LockRecord,
} from "./runLock";

function createMemoryStorage(): LockStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      return data.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      data.set(key, value);
    },
    async delete(key: string) {
      return data.delete(key);
    },
  };
}

const STALE_MS = 10 * 60 * 1000;

describe("runLock", () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("acquires a free lock", async () => {
    expect(await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000)).toBe(
      true,
    );
    expect(storage.data.get("lock:batch")).toEqual({
      acquiredAt: 1000,
      heartbeatAt: 1000,
    });
  });

  it("refuses a lock with a live heartbeat", async () => {
    await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000);
    expect(
      await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000 + STALE_MS - 1),
    ).toBe(false);
  });

  it("takes over a stale lock", async () => {
    await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000);
    expect(
      await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000 + STALE_MS),
    ).toBe(true);
  });

  it("heartbeat keeps a long run from going stale", async () => {
    await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000);
    await heartbeatLock(storage, "lock:batch", 1000 + STALE_MS);
    expect(
      await tryAcquireLock(storage, "lock:batch", STALE_MS, 1000 + STALE_MS + 1),
    ).toBe(false);
    expect(
      (storage.data.get("lock:batch") as LockRecord).acquiredAt,
    ).toBe(1000);
  });

  it("heartbeat does not create a lock that isn't held", async () => {
    await heartbeatLock(storage, "lock:batch", 5000);
    expect(storage.data.has("lock:batch")).toBe(false);
  });

  it("release frees the lock", async () => {
    await tryAcquireLock(storage, "lock:scan", STALE_MS, 1000);
    await releaseLock(storage, "lock:scan");
    expect(await tryAcquireLock(storage, "lock:scan", STALE_MS, 1001)).toBe(
      true,
    );
  });
});
