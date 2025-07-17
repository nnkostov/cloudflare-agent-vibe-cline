/**
 * Structured logging utility for better observability with tail workers
 */

interface LogContext {
  service?: string;
  operation?: string;
  repoId?: string;
  repoName?: string;
  duration?: number;
  apiCall?: 'github' | 'claude' | 'github-search';
  model?: string;
  error?: Error;
  metrics?: {
    repos_scanned?: number;
    repos_analyzed?: number;
    alerts_generated?: number;
  };
  [key: string]: any;
}

export class StructuredLogger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  /**
   * Log with structured context
   */
  log(message: string, context?: LogContext): void {
    const logData = {
      service: this.service,
      timestamp: new Date().toISOString(),
      ...context,
    };
    
    // Format for tail worker parsing
    console.log(`[${this.service}] ${message}`, JSON.stringify(logData));
  }

  /**
   * Log info level
   */
  info(message: string, context?: LogContext): void {
    console.info(`[${this.service}] INFO: ${message}`, context ? JSON.stringify(context) : '');
  }

  /**
   * Log warning level
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[${this.service}] WARN: ${message}`, context ? JSON.stringify(context) : '');
  }

  /**
   * Log error level
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    };
    
    console.error(`[${this.service}] ERROR: ${message}`, JSON.stringify(errorContext));
  }

  /**
   * Log API call
   */
  apiCall(api: 'github' | 'claude' | 'github-search', operation: string, context?: LogContext): void {
    this.log(`API Call: ${api} - ${operation}`, {
      ...context,
      apiCall: api,
      operation,
    });
  }

  /**
   * Log performance metric
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    this.log(`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      operation,
      duration,
    });
  }

  /**
   * Log scan metrics
   */
  scanMetrics(metrics: { repos_scanned?: number; repos_analyzed?: number; alerts_generated?: number }, context?: LogContext): void {
    this.log(`Scan Metrics: Scanned ${metrics.repos_scanned || 0}, Analyzed ${metrics.repos_analyzed || 0}, Alerts ${metrics.alerts_generated || 0}`, {
      ...context,
      metrics,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): StructuredLogger {
    const childLogger = new StructuredLogger(this.service);
    const originalLog = childLogger.log.bind(childLogger);
    
    childLogger.log = (message: string, context?: LogContext) => {
      originalLog(message, { ...additionalContext, ...context });
    };
    
    return childLogger;
  }
}

// Pre-configured loggers for common services
export const loggers = {
  worker: new StructuredLogger('Worker'),
  agent: new StructuredLogger('GitHubAgent'),
  github: new StructuredLogger('GitHubService'),
  claude: new StructuredLogger('ClaudeService'),
  storage: new StructuredLogger('StorageService'),
  analyzer: new StructuredLogger('RepoAnalyzer'),
};
