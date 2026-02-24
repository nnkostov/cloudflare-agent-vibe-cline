/**
 * Simple rate limiter for Cloudflare Workers
 * Uses in-memory counters that reset on each request
 */

export interface SimpleRateLimiterOptions {
  maxRequests: number; // Maximum requests per window
  windowMs: number; // Time window in milliseconds
}

export class SimpleRateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> =
    new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(options: SimpleRateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  /**
   * Check if request should be allowed
   */
  async checkLimit(key: string = "default"): Promise<boolean> {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      // New window
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment counter
    record.count++;
    return true;
  }

  /**
   * Get wait time until next available request
   */
  getWaitTime(key: string = "default"): number {
    const record = this.requests.get(key);
    if (!record) return 0;

    const now = Date.now();
    if (now > record.resetTime) return 0;

    return record.resetTime - now;
  }

  /**
   * Get current status
   */
  getStatus(key: string = "default"): { remaining: number; resetTime: number } {
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      return {
        remaining: this.maxRequests,
        resetTime: now + this.windowMs,
      };
    }

    return {
      remaining: Math.max(0, this.maxRequests - record.count),
      resetTime: record.resetTime,
    };
  }
}

// Pre-configured rate limiters
export const githubRateLimiter = new SimpleRateLimiter({
  maxRequests: 30, // 30 requests per minute
  windowMs: 60 * 1000, // 1 minute window
});

export const githubSearchRateLimiter = new SimpleRateLimiter({
  maxRequests: 10, // 10 searches per minute
  windowMs: 60 * 1000, // 1 minute window
});

export const claudeRateLimiter = new SimpleRateLimiter({
  maxRequests: 5, // 5 requests per minute
  windowMs: 60 * 1000, // 1 minute window
});

/**
 * Simple exponential backoff for retries
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: Error;
  let delay = 1000; // Start with 1 second

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries) {
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Double the delay
      }
    }
  }

  throw lastError!;
}
