/**
 * Connection Pool Manager for Cloudflare Workers
 * Manages concurrent connections to respect the 6 simultaneous connection limit
 */
export class ConnectionPool {
  private activeConnections = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private maxConnections = 6;
  private timeout = 30000; // 30 seconds timeout for queued requests

  constructor(maxConnections: number = 6) {
    this.maxConnections = maxConnections;
  }

  /**
   * Acquire a connection slot
   */
  async acquire(): Promise<void> {
    // Clean up old queued requests
    this.cleanupQueue();

    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++;
      return;
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, timestamp: Date.now() });
    });
  }

  /**
   * Release a connection slot
   */
  release(): void {
    this.activeConnections--;

    // Process next queued request
    const next = this.queue.shift();
    if (next) {
      this.activeConnections++;
      next.resolve();
    }
  }

  /**
   * Execute a function with connection management
   */
  async withConnection<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Get current connection stats
   */
  getStats(): {
    active: number;
    queued: number;
    available: number;
  } {
    return {
      active: this.activeConnections,
      queued: this.queue.length,
      available: this.maxConnections - this.activeConnections,
    };
  }

  /**
   * Clean up timed-out queued requests
   */
  private cleanupQueue(): void {
    const now = Date.now();
    this.queue = this.queue.filter((item) => {
      if (now - item.timestamp > this.timeout) {
        item.reject(new Error("Connection request timed out"));
        return false;
      }
      return true;
    });
  }
}

// Global connection pool instance
export const globalConnectionPool = new ConnectionPool();
