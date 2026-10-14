import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter } from "./rateLimiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T22:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const drain = async (limiter: RateLimiter, n: number) => {
    for (let i = 0; i < n; i++) expect(await limiter.checkLimit()).toBe(true);
  };

  it("allows a burst up to maxBurst", async () => {
    const limiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000, maxBurst: 10 });
    await drain(limiter, 10);
    expect(await limiter.checkLimit()).toBe(false);
  });

  it("refills at maxRequests per window, not at the burst size", async () => {
    const limiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000, maxBurst: 10 });
    await drain(limiter, 10);

    // 30/min = one token every 2s (the old bug refilled 10/min, every 6s)
    vi.advanceTimersByTime(2_000);
    expect(await limiter.checkLimit()).toBe(true);
    expect(await limiter.checkLimit()).toBe(false);

    vi.advanceTimersByTime(20_000);
    await drain(limiter, 10);
    expect(await limiter.checkLimit()).toBe(false);
  });

  it("never holds more than maxBurst tokens", async () => {
    const limiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000, maxBurst: 10 });
    vi.advanceTimersByTime(10 * 60_000);
    await drain(limiter, 10);
    expect(await limiter.checkLimit()).toBe(false);
  });

  it("acquire() resolves at the sustained rate once the burst is spent", async () => {
    const limiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000, maxBurst: 1 });
    await limiter.acquire();

    let resolved = false;
    void limiter.acquire().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(1_900);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(resolved).toBe(true);
  });
});
