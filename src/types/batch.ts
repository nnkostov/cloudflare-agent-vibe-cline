/**
 * Batch Analysis Configuration and Types
 */

export interface BatchConfig {
  // Timeout settings
  maxBatchRuntime: number;        // Maximum runtime for entire batch (ms)
  maxAnalysisTimeout: number;     // Maximum timeout per repository (ms)
  healthCheckInterval: number;    // How often to check batch health (ms)
  
  // Health thresholds
  minSuccessRate: number;         // Minimum success rate before auto-stop (0-1)
  maxConsecutiveFailures: number; // Max failures before circuit break
  
  // Credit protection
  maxCreditsPerBatch: number;     // Maximum estimated credits per batch
  maxCreditsPerHour: number;      // Maximum credits per hour
  
  // Recovery settings
  autoRecoveryEnabled: boolean;   // Enable automatic recovery
  recoveryDelay: number;          // Delay before auto-recovery (ms)
  maxRecoveryAttempts: number;    // Maximum recovery attempts
  
  // Rate limiting
  delayBetweenAnalyses: number;   // Delay between analyses (ms)
  maxRetries: number;             // Max retries per repository
  retryBackoffMultiplier: number; // Exponential backoff multiplier
}

export interface BatchHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'stopped';
  successRate: number;
  consecutiveFailures: number;
  estimatedCreditsUsed: number;
  runtimeElapsed: number;
  timeRemaining: number;
  message: string;
}

export interface BatchCheckpoint {
  batchId: string;
  timestamp: number;
  completedRepositories: string[];
  failedRepositories: string[];
  remainingRepositories: string[];
  health: BatchHealth;
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  // Timeout settings - more aggressive
  maxBatchRuntime: 30 * 60 * 1000,      // 30 minutes max
  maxAnalysisTimeout: 30 * 1000,        // 30 seconds per repo (reduced from 2 minutes)
  healthCheckInterval: 10 * 1000,       // Check health every 10 seconds
  
  // Health thresholds
  minSuccessRate: 0.5,                  // Stop if success rate < 50%
  maxConsecutiveFailures: 5,            // Stop after 5 consecutive failures
  
  // Credit protection
  maxCreditsPerBatch: 100,              // Max 100 credits per batch
  maxCreditsPerHour: 500,               // Max 500 credits per hour
  
  // Recovery settings
  autoRecoveryEnabled: true,            // Enable auto-recovery
  recoveryDelay: 5 * 60 * 1000,        // Wait 5 minutes before recovery
  maxRecoveryAttempts: 3,              // Try recovery up to 3 times
  
  // Rate limiting
  delayBetweenAnalyses: 2000,          // 2 seconds between analyses
  maxRetries: 2,                        // 2 retries per repo
  retryBackoffMultiplier: 1.5,         // 1.5x backoff
};

export interface EnhancedBatchProgress {
  batchId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'recovering';
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  currentRepository: string | null;
  startTime: number;
  estimatedCompletion: number | null;
  repositories: string[];
  results: Array<{ 
    repo: string; 
    status: 'success' | 'failed' | 'skipped' | 'timeout'; 
    error?: string;
    duration?: number;
    creditsUsed?: number;
  }>;
  health: BatchHealth;
  checkpoint?: BatchCheckpoint;
  recoveryAttempts: number;
  creditUsage: {
    estimated: number;
    actual: number;
    limit: number;
  };
}
