import type { Env, Repository } from '../types';
import { 
  BatchConfig, 
  BatchHealth, 
  BatchCheckpoint, 
  EnhancedBatchProgress, 
  DEFAULT_BATCH_CONFIG 
} from '../types/batch';

/**
 * Self-healing batch processor with automatic recovery and health monitoring
 */
export class BatchProcessor {
  private env: Env;
  private state: DurableObjectState;
  private config: BatchConfig;
  private healthCheckInterval?: number;
  private batchTimeoutHandle?: number;
  private hourlyCreditsUsed: number = 0;
  private hourlyCreditsResetTime: number = Date.now() + 3600000;

  constructor(env: Env, state: DurableObjectState, config?: Partial<BatchConfig>) {
    this.env = env;
    this.state = state;
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Start enhanced batch analysis with self-healing
   */
  async startEnhancedBatch(
    batchId: string, 
    repositories: string[],
    analyzeCallback: (repo: Repository) => Promise<any>
  ): Promise<void> {
    console.log(`[BatchProcessor] Starting enhanced batch ${batchId} with ${repositories.length} repositories`);
    
    // Initialize enhanced batch progress
    const batchProgress: EnhancedBatchProgress = {
      batchId,
      status: 'running',
      total: repositories.length,
      completed: 0,
      failed: 0,
      skipped: 0,
      currentRepository: repositories[0] || null,
      startTime: Date.now(),
      estimatedCompletion: null,
      repositories,
      results: [],
      health: this.calculateHealth(0, 0, 0, Date.now()),
      recoveryAttempts: 0,
      creditUsage: {
        estimated: repositories.length * 2, // Estimate 2 credits per repo
        actual: 0,
        limit: this.config.maxCreditsPerBatch
      }
    };

    // Store initial progress
    await this.state.storage.put(`batch_${batchId}`, batchProgress);

    // Set up batch timeout
    this.setupBatchTimeout(batchId, batchProgress);

    // Set up health monitoring
    this.startHealthMonitoring(batchId);

    // Process batch with self-healing
    this.processWithSelfHealing(batchProgress, analyzeCallback).catch(error => {
      console.error(`[BatchProcessor] Batch ${batchId} failed:`, error);
      this.handleBatchFailure(batchId, error);
    });
  }

  /**
   * Handle batch failure
   */
  private async handleBatchFailure(batchId: string, error: any): Promise<void> {
    console.error(`[BatchProcessor] Batch ${batchId} encountered fatal error:`, error);
    
    const batchProgress = await this.state.storage.get(`batch_${batchId}`) as EnhancedBatchProgress;
    if (batchProgress) {
      batchProgress.status = 'failed';
      batchProgress.health.status = 'critical';
      batchProgress.health.message = `Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.state.storage.put(`batch_${batchId}`, batchProgress);
    }

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.batchTimeoutHandle) {
      clearTimeout(this.batchTimeoutHandle);
    }
  }

  /**
   * Process batch with self-healing mechanisms
   */
  private async processWithSelfHealing(
    batchProgress: EnhancedBatchProgress,
    analyzeCallback: (repo: Repository) => Promise<any>
  ): Promise<void> {
    const { batchId, repositories } = batchProgress;
    let consecutiveFailures = 0;
    const startTime = Date.now();

    console.log(`[BatchProcessor] Processing batch ${batchId} with self-healing`);

    for (let i = 0; i < repositories.length; i++) {
      const repoFullName = repositories[i];

      // Check if batch should stop
      if (await this.shouldStopBatch(batchProgress)) {
        console.log(`[BatchProcessor] Stopping batch ${batchId} due to health check failure`);
        await this.stopBatch(batchId, 'Health check failed');
        return;
      }

      // Check credit limits
      if (await this.isOverCreditLimit(batchProgress)) {
        console.log(`[BatchProcessor] Stopping batch ${batchId} due to credit limit`);
        await this.stopBatch(batchId, 'Credit limit exceeded');
        return;
      }

      try {
        // Update current repository
        batchProgress.currentRepository = repoFullName;
        batchProgress.estimatedCompletion = this.estimateCompletion(
          startTime, 
          i + 1, 
          repositories.length
        );

        // Calculate and update health
        batchProgress.health = this.calculateHealth(
          batchProgress.completed,
          batchProgress.failed,
          batchProgress.skipped,
          startTime
        );

        await this.state.storage.put(`batch_${batchId}`, batchProgress);

        console.log(`[BatchProcessor] Analyzing ${repoFullName} (${i + 1}/${repositories.length})`);

        // Get repository
        const repo = await this.getRepository(repoFullName);
        if (!repo) {
          console.log(`[BatchProcessor] Repository ${repoFullName} not found, skipping`);
          batchProgress.skipped++;
          batchProgress.results.push({
            repo: repoFullName,
            status: 'skipped',
            error: 'Repository not found'
          });
          continue;
        }

        // Analyze with timeout and retry
        const analysisStart = Date.now();
        const result = await this.analyzeWithTimeout(
          repo, 
          analyzeCallback,
          this.config.maxAnalysisTimeout
        );

        if (result.success) {
          batchProgress.completed++;
          batchProgress.results.push({
            repo: repoFullName,
            status: 'success',
            duration: Date.now() - analysisStart,
            creditsUsed: 2 // Estimate
          });
          batchProgress.creditUsage.actual += 2;
          this.hourlyCreditsUsed += 2;
          consecutiveFailures = 0;
          console.log(`[BatchProcessor] ✅ Successfully analyzed ${repoFullName}`);
        } else {
          batchProgress.failed++;
          batchProgress.results.push({
            repo: repoFullName,
            status: result.timeout ? 'timeout' : 'failed',
            error: result.error,
            duration: Date.now() - analysisStart
          });
          consecutiveFailures++;
          console.log(`[BatchProcessor] ❌ Failed to analyze ${repoFullName}: ${result.error}`);

          // Check consecutive failures
          if (consecutiveFailures >= this.config.maxConsecutiveFailures) {
            console.log(`[BatchProcessor] Too many consecutive failures, initiating recovery`);
            if (await this.attemptRecovery(batchProgress)) {
              consecutiveFailures = 0; // Reset after successful recovery
            } else {
              await this.stopBatch(batchId, 'Recovery failed');
              return;
            }
          }
        }

        // Update progress
        await this.state.storage.put(`batch_${batchId}`, batchProgress);

        // Rate limiting with exponential backoff on failures
        const delay = consecutiveFailures > 0 
          ? this.config.delayBetweenAnalyses * Math.pow(this.config.retryBackoffMultiplier, consecutiveFailures)
          : this.config.delayBetweenAnalyses;
        
        if (i < repositories.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        console.error(`[BatchProcessor] Error processing ${repoFullName}:`, error);
        batchProgress.failed++;
        batchProgress.results.push({
          repo: repoFullName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        consecutiveFailures++;
      }
    }

    // Mark batch as completed
    await this.completeBatch(batchId, batchProgress);
  }

  /**
   * Analyze repository with timeout protection
   */
  private async analyzeWithTimeout(
    repo: Repository,
    analyzeCallback: (repo: Repository) => Promise<any>,
    timeout: number
  ): Promise<{ success: boolean; timeout?: boolean; error?: string }> {
    try {
      const analysisPromise = analyzeCallback(repo);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), timeout)
      );

      await Promise.race([analysisPromise, timeoutPromise]);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'Analysis timeout') {
        return { success: false, timeout: true, error: 'Analysis timeout' };
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Calculate batch health score
   */
  private calculateHealth(
    completed: number,
    failed: number,
    skipped: number,
    startTime: number
  ): BatchHealth {
    const total = completed + failed + skipped;
    const successRate = total > 0 ? completed / total : 1;
    const runtimeElapsed = Date.now() - startTime;
    const timeRemaining = Math.max(0, this.config.maxBatchRuntime - runtimeElapsed);

    let status: BatchHealth['status'] = 'healthy';
    let message = 'Batch processing normally';

    if (successRate < this.config.minSuccessRate) {
      status = 'critical';
      message = `Success rate (${Math.round(successRate * 100)}%) below threshold`;
    } else if (timeRemaining < 60000) { // Less than 1 minute
      status = 'degraded';
      message = 'Approaching timeout limit';
    } else if (failed > completed) {
      status = 'degraded';
      message = 'More failures than successes';
    }

    return {
      status,
      successRate,
      consecutiveFailures: 0, // This is tracked separately
      estimatedCreditsUsed: (completed + failed) * 2,
      runtimeElapsed,
      timeRemaining,
      message
    };
  }

  /**
   * Check if batch should stop based on health
   */
  private async shouldStopBatch(batchProgress: EnhancedBatchProgress): Promise<boolean> {
    const { health, startTime } = batchProgress;

    // Check runtime limit
    if (Date.now() - startTime > this.config.maxBatchRuntime) {
      console.log(`[BatchProcessor] Batch exceeded maximum runtime`);
      return true;
    }

    // Check success rate
    const total = batchProgress.completed + batchProgress.failed;
    if (total > 5 && health.successRate < this.config.minSuccessRate) {
      console.log(`[BatchProcessor] Success rate too low: ${Math.round(health.successRate * 100)}%`);
      return true;
    }

    // Check if batch was manually stopped
    const stored = await this.state.storage.get(`batch_${batchProgress.batchId}`) as EnhancedBatchProgress;
    if (stored && stored.status === 'stopped') {
      console.log(`[BatchProcessor] Batch was manually stopped`);
      return true;
    }

    return false;
  }

  /**
   * Check if over credit limit
   */
  private async isOverCreditLimit(batchProgress: EnhancedBatchProgress): Promise<boolean> {
    // Check batch credit limit
    if (batchProgress.creditUsage.actual >= this.config.maxCreditsPerBatch) {
      console.log(`[BatchProcessor] Batch credit limit reached: ${batchProgress.creditUsage.actual}/${this.config.maxCreditsPerBatch}`);
      return true;
    }

    // Check hourly credit limit
    if (Date.now() > this.hourlyCreditsResetTime) {
      this.hourlyCreditsUsed = 0;
      this.hourlyCreditsResetTime = Date.now() + 3600000;
    }

    if (this.hourlyCreditsUsed >= this.config.maxCreditsPerHour) {
      console.log(`[BatchProcessor] Hourly credit limit reached: ${this.hourlyCreditsUsed}/${this.config.maxCreditsPerHour}`);
      return true;
    }

    return false;
  }

  /**
   * Attempt recovery after failures
   */
  private async attemptRecovery(batchProgress: EnhancedBatchProgress): Promise<boolean> {
    if (!this.config.autoRecoveryEnabled) {
      return false;
    }

    if (batchProgress.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      console.log(`[BatchProcessor] Max recovery attempts reached`);
      return false;
    }

    console.log(`[BatchProcessor] Attempting recovery (attempt ${batchProgress.recoveryAttempts + 1}/${this.config.maxRecoveryAttempts})`);
    
    batchProgress.recoveryAttempts++;
    batchProgress.status = 'recovering';
    
    // Save checkpoint
    const checkpoint: BatchCheckpoint = {
      batchId: batchProgress.batchId,
      timestamp: Date.now(),
      completedRepositories: batchProgress.results
        .filter(r => r.status === 'success')
        .map(r => r.repo),
      failedRepositories: batchProgress.results
        .filter(r => r.status === 'failed' || r.status === 'timeout')
        .map(r => r.repo),
      remainingRepositories: batchProgress.repositories.slice(
        batchProgress.completed + batchProgress.failed + batchProgress.skipped
      ),
      health: batchProgress.health
    };
    
    batchProgress.checkpoint = checkpoint;
    await this.state.storage.put(`batch_${batchProgress.batchId}`, batchProgress);

    // Wait before recovery
    console.log(`[BatchProcessor] Waiting ${this.config.recoveryDelay / 1000}s before recovery`);
    await new Promise(resolve => setTimeout(resolve, this.config.recoveryDelay));

    // Resume from checkpoint
    batchProgress.status = 'running';
    await this.state.storage.put(`batch_${batchProgress.batchId}`, batchProgress);

    return true;
  }

  /**
   * Stop batch processing
   */
  private async stopBatch(batchId: string, reason: string): Promise<void> {
    console.log(`[BatchProcessor] Stopping batch ${batchId}: ${reason}`);
    
    const batchProgress = await this.state.storage.get(`batch_${batchId}`) as EnhancedBatchProgress;
    if (batchProgress) {
      batchProgress.status = 'stopped';
      batchProgress.health.message = reason;
      await this.state.storage.put(`batch_${batchId}`, batchProgress);
    }

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.batchTimeoutHandle) {
      clearTimeout(this.batchTimeoutHandle);
    }
  }

  /**
   * Complete batch processing
   */
  private async completeBatch(batchId: string, batchProgress: EnhancedBatchProgress): Promise<void> {
    batchProgress.status = 'completed';
    batchProgress.currentRepository = null;
    batchProgress.health = this.calculateHealth(
      batchProgress.completed,
      batchProgress.failed,
      batchProgress.skipped,
      batchProgress.startTime
    );

    await this.state.storage.put(`batch_${batchId}`, batchProgress);

    const successRate = Math.round((batchProgress.completed / batchProgress.total) * 100);
    console.log(`[BatchProcessor] 🎉 Batch ${batchId} completed: ${batchProgress.completed} successful, ${batchProgress.failed} failed, ${batchProgress.skipped} skipped (${successRate}% success rate)`);

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.batchTimeoutHandle) {
      clearTimeout(this.batchTimeoutHandle);
    }
  }

  /**
   * Set up batch timeout
   */
  private setupBatchTimeout(batchId: string, batchProgress: EnhancedBatchProgress): void {
    this.batchTimeoutHandle = setTimeout(() => {
      console.log(`[BatchProcessor] Batch ${batchId} timeout reached`);
      this.stopBatch(batchId, 'Maximum runtime exceeded');
    }, this.config.maxBatchRuntime) as any;
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(batchId: string): void {
    this.healthCheckInterval = setInterval(async () => {
      const batchProgress = await this.state.storage.get(`batch_${batchId}`) as EnhancedBatchProgress;
      if (!batchProgress || batchProgress.status !== 'running') {
        clearInterval(this.healthCheckInterval!);
        return;
      }

      const health = this.calculateHealth(
        batchProgress.completed,
        batchProgress.failed,
        batchProgress.skipped,
        batchProgress.startTime
      );

      if (health.status === 'critical') {
        console.log(`[BatchProcessor] Batch ${batchId} health critical: ${health.message}`);
        await this.stopBatch(batchId, health.message);
      }
    }, this.config.healthCheckInterval) as any;
  }

  /**
   * Get repository by full name
   */
  private async getRepository(fullName: string): Promise<Repository | null> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM repositories WHERE full_name = ?'
    ).bind(fullName).first();

    if (!result) {
      return null;
    }

    return {
      id: String(result.id),
      name: String(result.name),
      owner: String(result.owner),
      full_name: String(result.full_name),
      description: String(result.description || ''),
      stars: Number(result.stars || 0),
      forks: Number(result.forks || 0),
      open_issues: Number(result.open_issues || 0),
      language: String(result.language || ''),
      topics: Array.isArray(result.topics) ? result.topics : JSON.parse(String(result.topics || '[]')),
      created_at: String(result.created_at),
      updated_at: String(result.updated_at),
      pushed_at: String(result.pushed_at),
      is_archived: Boolean(result.is_archived),
      is_fork: Boolean(result.is_fork),
      html_url: String(result.html_url || ''),
      clone_url: String(result.clone_url || ''),
      default_branch: String(result.default_branch || 'main'),
    } as Repository;
  }

  /**
   * Estimate completion time
   */
  private estimateCompletion(startTime: number, completed: number, total: number): number {
    if (completed === 0) return startTime + (total * this.config.delayBetweenAnalyses);
    
    const elapsed = Date.now() - startTime;
    const avgTimePerRepo = elapsed / completed;
    const remaining = total - completed;
    
    return Date.now() + (remaining * avgTimePerRepo);
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<EnhancedBatchProgress | null> {
    return await this.state.storage.get(`batch_${batchId}`) as EnhancedBatchProgress | null;
  }

  /**
   * Manually stop a batch
   */
  async manualStopBatch(batchId: string): Promise<void> {
    await this.stopBatch(batchId, 'Manually stopped by user');
  }

  /**
   * Clear all batch data
   */
  async clearAllBatches(): Promise<number> {
    const allKeys = await this.state.storage.list({ prefix: 'batch_' });
    let clearedCount = 0;
    
    for (const [key] of allKeys) {
      await this.state.storage.delete(key);
      clearedCount++;
    }
    
    return clearedCount;
  }
}
