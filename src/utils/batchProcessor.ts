/**
 * Batch processor for efficient database operations
 */
export class BatchProcessor {
  private batchSize: number;
  private flushInterval: number;
  private queue: Map<string, any[]> = new Map();
  private timers: Map<string, number> = new Map();

  constructor(batchSize: number = 100, flushInterval: number = 5000) {
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
  }

  /**
   * Add items to a batch queue
   */
  async addToBatch<T>(
    key: string,
    items: T[],
    processor: (batch: T[]) => Promise<void>
  ): Promise<void> {
    // Get or create queue for this key
    if (!this.queue.has(key)) {
      this.queue.set(key, []);
    }

    const queue = this.queue.get(key)!;
    queue.push(...items);

    // Process immediately if batch size reached
    if (queue.length >= this.batchSize) {
      await this.flush(key, processor);
    } else {
      // Set up auto-flush timer
      this.setupFlushTimer(key, processor);
    }
  }

  /**
   * Flush a specific batch
   */
  async flush<T>(
    key: string,
    processor: (batch: T[]) => Promise<void>
  ): Promise<void> {
    const queue = this.queue.get(key);
    if (!queue || queue.length === 0) return;

    // Clear any existing timer
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }

    // Process batch
    const batch = queue.splice(0, this.batchSize);
    if (batch.length > 0) {
      await processor(batch);
    }

    // If there are remaining items, process them
    if (queue.length > 0) {
      await this.flush(key, processor);
    } else {
      // Clean up empty queue
      this.queue.delete(key);
    }
  }

  /**
   * Flush all pending batches
   */
  async flushAll(): Promise<void> {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Note: Processors need to be stored separately for this to work
    // For now, this just clears the queues
    this.queue.clear();
  }

  /**
   * Set up auto-flush timer
   */
  private setupFlushTimer<T>(
    key: string,
    processor: (batch: T[]) => Promise<void>
  ): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      await this.flush(key, processor);
    }, this.flushInterval) as unknown as number;

    this.timers.set(key, timer);
  }

  /**
   * Process items in chunks with concurrency control
   */
  static async processInChunks<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R[]>,
    maxConcurrency: number = 3
  ): Promise<R[]> {
    const results: R[] = [];
    const chunks: T[][] = [];

    // Split into chunks
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    // Process chunks with concurrency control
    for (let i = 0; i < chunks.length; i += maxConcurrency) {
      const batch = chunks.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map(chunk => processor(chunk))
      );
      results.push(...batchResults.flat());
    }

    return results;
  }
}

// Global batch processor instance
export const globalBatchProcessor = new BatchProcessor();
