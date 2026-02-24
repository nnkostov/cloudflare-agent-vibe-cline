/**
 * Performance monitoring utilities for Cloudflare Workers
 * Tracks execution time and provides timeout management
 */

export interface PerformanceCheckpoint {
  name: string;
  time: number;
  memory?: number;
}

export interface PerformanceReport {
  total: number;
  checkpoints: Record<string, number>;
  memoryUsage?: {
    peak: number;
    average: number;
  };
  warnings: string[];
}

export class PerformanceMonitor {
  private startTime: number;
  private checkpoints: Map<string, PerformanceCheckpoint> = new Map();
  private warnings: string[] = [];
  private memorySnapshots: number[] = [];

  constructor() {
    this.startTime = Date.now();
    this.captureMemorySnapshot();
  }

  /**
   * Record a checkpoint in the execution
   */
  checkpoint(name: string): void {
    const time = Date.now() - this.startTime;
    const memory = this.getCurrentMemoryUsage();

    this.checkpoints.set(name, { name, time, memory });
    this.captureMemorySnapshot();

    // Add warnings for long operations
    if (time > 10000) {
      // 10 seconds
      this.warnings.push(`Checkpoint '${name}' took ${time}ms`);
    }
  }

  /**
   * Get elapsed time since start
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get a detailed performance report
   */
  getReport(): PerformanceReport {
    const total = Date.now() - this.startTime;
    const checkpoints: Record<string, number> = {};

    this.checkpoints.forEach((checkpoint, name) => {
      checkpoints[name] = checkpoint.time;
    });

    const report: PerformanceReport = {
      total,
      checkpoints,
      warnings: [...this.warnings],
    };

    // Add memory usage if available
    if (this.memorySnapshots.length > 0) {
      report.memoryUsage = {
        peak: Math.max(...this.memorySnapshots),
        average:
          this.memorySnapshots.reduce((a, b) => a + b, 0) /
          this.memorySnapshots.length,
      };
    }

    return report;
  }

  /**
   * Execute a promise with timeout
   */
  async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes("timed out")) {
        this.warnings.push(error.message);
      }
      throw error;
    }
  }

  /**
   * Monitor an async operation
   */
  async monitor<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: {
      timeout?: number;
      warnThreshold?: number;
    },
  ): Promise<T> {
    const startTime = Date.now();
    const { timeout, warnThreshold = 5000 } = options || {};

    try {
      let result: T;

      if (timeout) {
        result = await this.withTimeout(fn(), timeout, operation);
      } else {
        result = await fn();
      }

      const duration = Date.now() - startTime;
      this.checkpoint(operation);

      if (duration > warnThreshold) {
        this.warnings.push(
          `Operation '${operation}' took ${duration}ms (threshold: ${warnThreshold}ms)`,
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.warnings.push(
        `Operation '${operation}' failed after ${duration}ms: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Check if we're approaching Worker limits
   */
  checkLimits(): {
    cpuTime: boolean;
    memory: boolean;
    duration: boolean;
  } {
    const elapsed = this.getElapsedTime();
    const memory = this.getCurrentMemoryUsage();

    return {
      cpuTime: elapsed > 270000, // 4.5 minutes (warning before 5 min limit)
      memory: memory > 100, // 100MB (warning before 128MB limit)
      duration: elapsed > 840000, // 14 minutes (warning before 15 min limit for cron)
    };
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    // In a real Worker environment, you might use performance.memory if available
    // For now, return a placeholder
    if (typeof performance !== "undefined" && "memory" in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Capture memory snapshot
   */
  private captureMemorySnapshot(): void {
    const memory = this.getCurrentMemoryUsage();
    if (memory > 0) {
      this.memorySnapshots.push(memory);

      // Keep only last 100 snapshots to avoid memory issues
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots.shift();
      }
    }
  }

  /**
   * Create a summary log entry
   */
  getSummary(): string {
    const report = this.getReport();
    const limits = this.checkLimits();

    let summary = `Performance Summary:\n`;
    summary += `Total Time: ${report.total}ms\n`;

    if (report.memoryUsage) {
      summary += `Memory - Peak: ${report.memoryUsage.peak.toFixed(2)}MB, Avg: ${report.memoryUsage.average.toFixed(2)}MB\n`;
    }

    if (Object.keys(report.checkpoints).length > 0) {
      summary += `Checkpoints:\n`;
      Object.entries(report.checkpoints).forEach(([name, time]) => {
        summary += `  - ${name}: ${time}ms\n`;
      });
    }

    if (report.warnings.length > 0) {
      summary += `Warnings:\n`;
      report.warnings.forEach((warning) => {
        summary += `  - ${warning}\n`;
      });
    }

    if (limits.cpuTime || limits.memory || limits.duration) {
      summary += `LIMIT WARNINGS:\n`;
      if (limits.cpuTime) summary += `  - Approaching CPU time limit\n`;
      if (limits.memory) summary += `  - Approaching memory limit\n`;
      if (limits.duration) summary += `  - Approaching duration limit\n`;
    }

    return summary;
  }
}

/**
 * Global performance monitor for request-scoped tracking
 */
export function createRequestMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}

/**
 * Decorator for monitoring method performance
 */
export function monitored(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const monitor = new PerformanceMonitor();
    const methodName = `${target.constructor.name}.${propertyKey}`;

    try {
      const result = await monitor.monitor(methodName, () =>
        originalMethod.apply(this, args),
      );

      // Log if operation took too long
      const report = monitor.getReport();
      if (report.total > 1000) {
        console.log(`[Performance] ${methodName} took ${report.total}ms`);
      }

      return result;
    } catch (error) {
      console.error(`[Performance] ${methodName} failed:`, error);
      throw error;
    }
  };

  return descriptor;
}
