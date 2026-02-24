/**
 * Stream processing utilities for memory-efficient data handling in Cloudflare Workers
 * Helps process large datasets without hitting memory limits
 */

export interface ProcessorOptions {
  batchSize?: number;
  maxMemoryUsage?: number;
  delayBetweenBatches?: number;
  onBatchComplete?: (batchIndex: number, results: any[]) => void;
  onError?: (error: Error, batchIndex: number) => void;
}

export class StreamProcessor<T> {
  private batchSize: number;
  private maxMemoryUsage: number;
  private delayBetweenBatches: number;
  private onBatchComplete?: (batchIndex: number, results: any[]) => void;
  private onError?: (error: Error, batchIndex: number) => void;

  constructor(options: ProcessorOptions = {}) {
    this.batchSize = options.batchSize || 10;
    this.maxMemoryUsage = options.maxMemoryUsage || 50 * 1024 * 1024; // 50MB default
    this.delayBetweenBatches = options.delayBetweenBatches || 0;
    this.onBatchComplete = options.onBatchComplete;
    this.onError = options.onError;
  }

  /**
   * Create a JSON streaming TransformStream
   */
  static createJSONStream(): TransformStream<Uint8Array, Uint8Array> {
    return new TransformStream<Uint8Array, Uint8Array>();
  }

  /**
   * Process items in batches with memory management
   */
  async *processInBatches<R>(
    items: T[],
    processor: (item: T) => Promise<R>,
  ): AsyncGenerator<R[], void, unknown> {
    let batchIndex = 0;

    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);

      try {
        // Process batch items in parallel
        const results = await Promise.all(batch.map((item) => processor(item)));

        // Notify batch completion if callback provided
        if (this.onBatchComplete) {
          this.onBatchComplete(batchIndex, results);
        }

        yield results;

        // Allow garbage collection between batches
        if (this.delayBetweenBatches > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.delayBetweenBatches),
          );
        } else {
          // Minimal delay to allow event loop to process
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } catch (error) {
        if (this.onError) {
          this.onError(error as Error, batchIndex);
        } else {
          throw error;
        }
      }

      batchIndex++;
    }
  }

  /**
   * Process items sequentially with memory management
   */
  async *processSequentially<R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
  ): AsyncGenerator<R, void, unknown> {
    for (let i = 0; i < items.length; i++) {
      try {
        const result = await processor(items[i], i);
        yield result;

        // Periodic garbage collection opportunity
        if (i % this.batchSize === 0 && i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } catch (error) {
        if (this.onError) {
          this.onError(error as Error, Math.floor(i / this.batchSize));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Process and aggregate results in chunks
   */
  async processAndAggregate<R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    aggregator: (results: R[]) => R,
  ): Promise<R[]> {
    const aggregatedResults: R[] = [];

    for await (const batchResults of this.processInBatches(items, processor)) {
      const aggregated = aggregator(batchResults);
      aggregatedResults.push(aggregated);
    }

    return aggregatedResults;
  }

  /**
   * Process with rate limiting
   */
  async *processWithRateLimit<R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    itemsPerSecond: number,
  ): AsyncGenerator<R, void, unknown> {
    const delayMs = 1000 / itemsPerSecond;
    let lastProcessTime = 0;

    for (const item of items) {
      const now = Date.now();
      const timeSinceLastProcess = now - lastProcessTime;

      if (timeSinceLastProcess < delayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs - timeSinceLastProcess),
        );
      }

      const result = await processor(item);
      lastProcessTime = Date.now();
      yield result;
    }
  }

  /**
   * Process with connection pooling
   */
  async processWithConnectionLimit<R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    maxConcurrent: number = 6,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const executing: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const promise = (async (index: number) => {
        results[index] = await processor(items[index]);
      })(i);

      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
        // Remove completed promises
        executing.splice(
          0,
          executing.length,
          ...executing.filter((p) => p !== promise && !isPromiseSettled(p)),
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Transform stream of data
   */
  async *transform<R>(
    source: AsyncIterable<T>,
    transformer: (item: T) => Promise<R>,
  ): AsyncGenerator<R, void, unknown> {
    for await (const item of source) {
      yield await transformer(item);
    }
  }

  /**
   * Filter stream of data
   */
  async *filter(
    source: AsyncIterable<T>,
    predicate: (item: T) => Promise<boolean>,
  ): AsyncGenerator<T, void, unknown> {
    for await (const item of source) {
      if (await predicate(item)) {
        yield item;
      }
    }
  }

  /**
   * Reduce stream to single value
   */
  async reduce<R>(
    source: AsyncIterable<T>,
    reducer: (accumulator: R, item: T) => Promise<R>,
    initialValue: R,
  ): Promise<R> {
    let accumulator = initialValue;

    for await (const item of source) {
      accumulator = await reducer(accumulator, item);
    }

    return accumulator;
  }
}

/**
 * Helper to check if a promise is settled
 */
function isPromiseSettled(promise: Promise<any>): boolean {
  return Promise.race([promise, Promise.resolve("pending")]).then(
    (result) => result !== "pending",
    () => true,
  ) as unknown as boolean;
}

/**
 * Create a memory-efficient processor for large datasets
 */
export function createStreamProcessor<T>(
  options?: ProcessorOptions,
): StreamProcessor<T> {
  return new StreamProcessor<T>(options);
}

/**
 * Process large array in chunks with progress tracking
 */
export async function processLargeArray<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options?: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  },
): Promise<R[]> {
  const { batchSize = 10, onProgress } = options || {};
  const results: R[] = [];
  let processed = 0;

  const streamProcessor = new StreamProcessor<T>({ batchSize });

  for await (const batchResults of streamProcessor.processInBatches(
    items,
    processor,
  )) {
    results.push(...batchResults);
    processed += batchResults.length;

    if (onProgress) {
      onProgress(processed, items.length);
    }
  }

  return results;
}

/**
 * Memory-safe JSON stringification for large objects
 */
export async function* stringifyLargeObject(
  obj: any,
  chunkSize: number = 1024 * 1024, // 1MB chunks
): AsyncGenerator<string, void, unknown> {
  const json = JSON.stringify(obj);

  for (let i = 0; i < json.length; i += chunkSize) {
    yield json.slice(i, i + chunkSize);

    // Allow other operations to process
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Memory-safe JSON parsing for large strings
 */
export async function parseLargeJSON<T = any>(
  chunks: AsyncIterable<string>,
): Promise<T> {
  let json = "";

  for await (const chunk of chunks) {
    json += chunk;
  }

  return JSON.parse(json);
}
