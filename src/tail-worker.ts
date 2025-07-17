import type { Env } from './types';

interface TailEvent {
  scriptName: string;
  outcome: 'ok' | 'exception' | 'exceededCpu' | 'canceled' | 'unknown';
  eventTimestamp: number;
  event: {
    request?: {
      url: string;
      method: string;
      headers: Record<string, string>;
      cf?: {
        colo: string;
        country?: string;
        city?: string;
      };
    };
  };
  logs: Array<{
    message: string[];
    level: 'log' | 'error' | 'warn' | 'info' | 'debug';
    timestamp: number;
  }>;
  exceptions: Array<{
    name: string;
    message: string;
    timestamp: number;
    stack?: string;
  }>;
  diagnosticsChannelEvents?: Array<{
    channel: string;
    message: any;
    timestamp: number;
  }>;
}

interface ProcessedLog {
  id: string;
  timestamp: string;
  script_name: string;
  outcome: string;
  request_url?: string;
  request_method?: string;
  cf_colo?: string;
  cf_country?: string;
  duration_ms?: number;
  log_level?: string;
  log_message?: string;
  error_name?: string;
  error_message?: string;
  error_stack?: string;
  api_calls?: {
    github: number;
    claude: number;
  };
  metrics?: {
    repos_scanned?: number;
    repos_analyzed?: number;
    alerts_generated?: number;
  };
}

export class TailWorker {
  private env: Env;
  private batchSize = 100;
  private logBatch: ProcessedLog[] = [];

  constructor(env: Env) {
    this.env = env;
  }

  async tail(events: TailEvent[]): Promise<void> {
    console.log(`[TailWorker] Processing ${events.length} events`);
    
    for (const event of events) {
      try {
        await this.processEvent(event);
      } catch (error) {
        console.error('[TailWorker] Error processing event:', error);
      }
    }

    // Flush any remaining logs
    if (this.logBatch.length > 0) {
      await this.flushLogs();
    }
  }

  private async processEvent(event: TailEvent): Promise<void> {
    const baseLog: Partial<ProcessedLog> = {
      id: this.generateId(),
      timestamp: new Date(event.eventTimestamp).toISOString(),
      script_name: event.scriptName,
      outcome: event.outcome,
    };

    // Process request information
    if (event.event.request) {
      baseLog.request_url = event.event.request.url;
      baseLog.request_method = event.event.request.method;
      baseLog.cf_colo = event.event.request.cf?.colo;
      baseLog.cf_country = event.event.request.cf?.country;
    }

    // Process console logs
    for (const log of event.logs) {
      const processedLog: ProcessedLog = {
        ...baseLog as ProcessedLog,
        log_level: log.level,
        log_message: log.message.join(' '),
      };

      // Extract metrics from structured logs
      this.extractMetrics(processedLog, log.message);
      
      this.logBatch.push(processedLog);
    }

    // Process exceptions
    for (const exception of event.exceptions) {
      const processedLog: ProcessedLog = {
        ...baseLog as ProcessedLog,
        log_level: 'error',
        error_name: exception.name,
        error_message: exception.message,
        error_stack: exception.stack,
      };
      
      this.logBatch.push(processedLog);
    }

    // Flush logs if batch is full
    if (this.logBatch.length >= this.batchSize) {
      await this.flushLogs();
    }
  }

  private extractMetrics(log: ProcessedLog, messages: string[]): void {
    const message = messages.join(' ');
    
    // Extract API call counts
    const apiCalls = { github: 0, claude: 0 };
    
    if (message.includes('GitHub API') || message.includes('github.com')) {
      apiCalls.github = 1;
    }
    
    if (message.includes('Claude') || message.includes('Anthropic')) {
      apiCalls.claude = 1;
    }
    
    if (apiCalls.github > 0 || apiCalls.claude > 0) {
      log.api_calls = apiCalls;
    }

    // Extract scan/analysis metrics
    const metrics: any = {};
    
    // Look for repository scan patterns
    const scanMatch = message.match(/Found (\d+) repositories/);
    if (scanMatch) {
      metrics.repos_scanned = parseInt(scanMatch[1]);
    }
    
    // Look for analysis patterns
    const analyzeMatch = message.match(/Analyzing (\d+) repositories/);
    if (analyzeMatch) {
      metrics.repos_analyzed = parseInt(analyzeMatch[1]);
    }
    
    // Look for alert patterns
    const alertMatch = message.match(/Generated (\d+) alerts?/);
    if (alertMatch) {
      metrics.alerts_generated = parseInt(alertMatch[1]);
    }
    
    if (Object.keys(metrics).length > 0) {
      log.metrics = metrics;
    }

    // Extract duration if present
    const durationMatch = message.match(/in (\d+)ms/);
    if (durationMatch) {
      log.duration_ms = parseInt(durationMatch[1]);
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logBatch.length === 0) return;
    
    console.log(`[TailWorker] Flushing ${this.logBatch.length} logs to database`);
    
    try {
      // Batch insert logs into D1
      const values = this.logBatch.map(log => 
        `('${log.id}', '${log.timestamp}', '${log.script_name}', '${log.outcome}', 
          ${log.request_url ? `'${this.escapeString(log.request_url)}'` : 'NULL'}, 
          ${log.request_method ? `'${log.request_method}'` : 'NULL'},
          ${log.cf_colo ? `'${log.cf_colo}'` : 'NULL'},
          ${log.cf_country ? `'${log.cf_country}'` : 'NULL'},
          ${log.duration_ms || 'NULL'},
          ${log.log_level ? `'${log.log_level}'` : 'NULL'},
          ${log.log_message ? `'${this.escapeString(log.log_message)}'` : 'NULL'},
          ${log.error_name ? `'${this.escapeString(log.error_name)}'` : 'NULL'},
          ${log.error_message ? `'${this.escapeString(log.error_message)}'` : 'NULL'},
          ${log.error_stack ? `'${this.escapeString(log.error_stack)}'` : 'NULL'},
          ${log.api_calls ? `'${JSON.stringify(log.api_calls)}'` : 'NULL'},
          ${log.metrics ? `'${JSON.stringify(log.metrics)}'` : 'NULL'})`
      ).join(',\n');

      await this.env.DB.prepare(`
        INSERT INTO tail_logs (
          id, timestamp, script_name, outcome, request_url, request_method,
          cf_colo, cf_country, duration_ms, log_level, log_message,
          error_name, error_message, error_stack, api_calls, metrics
        ) VALUES ${values}
      `).run();

      // Also send critical errors to an alert endpoint
      const criticalErrors = this.logBatch.filter(log => 
        log.error_name && (
          log.error_message?.includes('rate limit') ||
          log.error_message?.includes('API key') ||
          log.error_name.includes('Critical')
        )
      );

      if (criticalErrors.length > 0) {
        await this.sendAlerts(criticalErrors);
      }

      // Clear the batch
      this.logBatch = [];
    } catch (error) {
      console.error('[TailWorker] Error flushing logs:', error);
      
      // Try to at least save to R2 as backup
      try {
        const timestamp = new Date().toISOString();
        const key = `logs/failed/${timestamp}-${this.generateId()}.json`;
        await this.env.STORAGE.put(key, JSON.stringify(this.logBatch));
        console.log(`[TailWorker] Saved failed logs to R2: ${key}`);
      } catch (r2Error) {
        console.error('[TailWorker] Failed to save to R2:', r2Error);
      }
      
      // Clear batch to prevent memory issues
      this.logBatch = [];
    }
  }

  private async sendAlerts(errors: ProcessedLog[]): Promise<void> {
    // In a real implementation, this could send to Slack, email, etc.
    console.log(`[TailWorker] Sending ${errors.length} critical error alerts`);
    
    for (const error of errors) {
      await this.env.DB.prepare(`
        INSERT INTO alerts (repo_id, type, level, message, metadata)
        VALUES (
          'system',
          'system_error',
          'critical',
          ?,
          ?
        )
      `).bind(
        `System Error: ${error.error_name} - ${error.error_message}`,
        JSON.stringify({
          timestamp: error.timestamp,
          script_name: error.script_name,
          error_stack: error.error_stack,
          request_url: error.request_url,
        })
      ).run();
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }
}

export default {
  async tail(events: TailEvent[], env: Env): Promise<void> {
    const worker = new TailWorker(env);
    await worker.tail(events);
  }
};
