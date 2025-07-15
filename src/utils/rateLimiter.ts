/**
 * Rate limiter for API calls to prevent abuse detection
 * Implements token bucket algorithm with burst support
 */

export interface RateLimiterOptions {
  maxRequests: number;      // Maximum requests per window
  windowMs: number;         // Time window in milliseconds
  maxBurst?: number;        // Maximum burst size (defaults to maxRequests)
  minDelay?: number;        // Minimum delay between requests in ms
}

export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private windowMs: number;
  private minDelay: number;
  private lastRefill: number;
  private lastRequest: number;
  private queue: Array<() => void> = [];

  constructor(options: RateLimiterOptions) {
    this.maxTokens = options.maxBurst || options.maxRequests;
    this.tokens = this.maxTokens;
    this.windowMs = options.windowMs;
    this.minDelay = options.minDelay || 0;
    this.lastRefill = Date.now();
    this.lastRequest = 0;
  }

  /**
   * Wait for rate limit clearance before proceeding
   */
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    // Refill tokens based on time passed
    this.refillTokens();

    // Check minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.minDelay) {
      setTimeout(() => this.processQueue(), this.minDelay - timeSinceLastRequest);
      return;
    }

    // Check if we have tokens available
    if (this.tokens < 1) {
      // Calculate wait time until next token
      const timeUntilNextToken = this.windowMs / this.maxTokens;
      setTimeout(() => this.processQueue(), timeUntilNextToken);
      return;
    }

    // Process request
    const resolve = this.queue.shift();
    if (resolve) {
      this.tokens--;
      this.lastRequest = Date.now();
      resolve();
      
      // Process next request after minimum delay
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), this.minDelay);
      }
    }
  }

  /**
   * Refill tokens based on time passed
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / this.windowMs) * this.maxTokens;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    availableTokens: number;
    maxTokens: number;
    queueLength: number;
  } {
    this.refillTokens();
    return {
      availableTokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      queueLength: this.queue.length,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.lastRequest = 0;
    this.queue = [];
  }
}

/**
 * GitHub API rate limiter
 * - 5000 requests per hour for authenticated requests
 * - But we use conservative limits to avoid abuse detection
 */
export const githubRateLimiter = new RateLimiter({
  maxRequests: 30,        // 30 requests per minute (very conservative)
  windowMs: 60 * 1000,    // 1 minute window
  maxBurst: 10,           // Allow burst of 10 requests
  minDelay: 100,          // 100ms minimum between requests
});

/**
 * GitHub search API rate limiter (more restrictive)
 */
export const githubSearchRateLimiter = new RateLimiter({
  maxRequests: 10,        // 10 searches per minute
  windowMs: 60 * 1000,    // 1 minute window
  maxBurst: 3,            // Allow burst of 3 searches
  minDelay: 1000,         // 1 second minimum between searches
});

/**
 * Claude/Anthropic API rate limiter (very restrictive)
 */
export const claudeRateLimiter = new RateLimiter({
  maxRequests: 5,         // 5 requests per minute (conservative for free tier)
  windowMs: 60 * 1000,    // 1 minute window
  maxBurst: 2,            // Small burst allowed
  minDelay: 2000,         // 2 seconds minimum between requests
});

/**
 * Generic external API rate limiter
 */
export const externalApiRateLimiter = new RateLimiter({
  maxRequests: 60,        // 60 requests per minute
  windowMs: 60 * 1000,    // 1 minute window
  maxBurst: 10,           // Reasonable burst
  minDelay: 50,           // 50ms minimum between requests
});

/**
 * Decorator for rate-limited methods
 */
export function RateLimit(limiter: RateLimiter) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      await limiter.acquire();
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Exponential backoff for retry logic
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error
      if (error instanceof Error && error.message.includes('abuse detection')) {
        console.warn(`Rate limit hit, waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
        
        if (i < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * factor, maxDelay);
        }
      } else {
        // For non-rate-limit errors, throw immediately
        throw error;
      }
    }
  }

  throw lastError!;
}
