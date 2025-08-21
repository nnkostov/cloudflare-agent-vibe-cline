import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, Loader2, AlertCircle, StopCircle, Zap, RefreshCw, XCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface BatchProgressProps {
  batchId: string | null;
  onComplete: () => void;
  onError: (error: string) => void;
}

interface FailedRepo {
  id: string;
  name: string;
  error: string;
  errorType: 'rate_limit' | 'not_found' | 'no_readme' | 'auth_error' | 'timeout' | 'claude_error' | 'network' | 'unknown';
  retryable: boolean;
  attempts: number;
}

// Configuration for batch processing
const BATCH_CONFIG = {
  PARALLEL_WORKERS: 3,      // Process 3 repos simultaneously
  DELAY_BETWEEN_REPOS: 100, // 100ms delay between starting each repo
  RATE_LIMIT_DELAY: 1000,   // 1 second delay when rate limited
  MAX_RETRIES: 2,           // Max retries per repository
  EXPONENTIAL_BACKOFF_BASE: 1000, // Base delay for exponential backoff
};

// Error type classification
const classifyError = (status: number, error: any): { type: FailedRepo['errorType'], retryable: boolean } => {
  if (status === 429) return { type: 'rate_limit', retryable: true };
  if (status === 404) return { type: 'not_found', retryable: false };
  if (status === 401 || status === 403) return { type: 'auth_error', retryable: false };
  if (status === 408 || (error && error.message?.includes('timeout'))) return { type: 'timeout', retryable: true };
  if (error && error.message?.includes('Claude')) return { type: 'claude_error', retryable: true };
  if (error && error.message?.includes('network')) return { type: 'network', retryable: true };
  if (error && error.message?.includes('README')) return { type: 'no_readme', retryable: false };
  return { type: 'unknown', retryable: true };
};

export function BatchProgress({ batchId, onComplete, onError }: BatchProgressProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'stopping' | 'completed'>('idle');
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    currentChunk: [] as string[],
    successCount: 0,
    failedCount: 0,
    currentlyProcessing: [] as string[],
    estimatedTimeRemaining: '',
    failedRepos: [] as FailedRepo[],
  });
  const [showFailedDetails, setShowFailedDetails] = useState(false);
  
  // Use refs to track state
  const shouldStopRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const processedCountRef = useRef(0);

  useEffect(() => {
    // If no batchId, set status to idle
    if (!batchId) {
      setStatus('idle');
      setProgress({
        processed: 0,
        total: 0,
        currentChunk: [],
        successCount: 0,
        failedCount: 0,
        currentlyProcessing: [],
        estimatedTimeRemaining: '',
        failedRepos: [],
      });
      shouldStopRef.current = false;
      processedCountRef.current = 0;
      return;
    }

    // When batchId is set, start processing
    setStatus('running');
    shouldStopRef.current = false;
    startTimeRef.current = Date.now();
    processedCountRef.current = 0;
    processNextChunk();
  }, [batchId]);

  // Calculate estimated time remaining
  const updateEstimatedTime = (processed: number, total: number) => {
    if (processed === 0) return 'Calculating...';
    
    const elapsed = Date.now() - startTimeRef.current;
    const avgTimePerRepo = elapsed / processed;
    const remaining = total - processed;
    const estimatedMs = remaining * avgTimePerRepo;
    
    const minutes = Math.floor(estimatedMs / 60000);
    const seconds = Math.floor((estimatedMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `~${minutes}m ${seconds}s remaining`;
    }
    return `~${seconds}s remaining`;
  };

  // Process a single repository with enhanced error handling
  const processRepository = async (repo: any, attemptNumber = 0): Promise<boolean> => {
    let retries = attemptNumber;
    
    while (retries <= BATCH_CONFIG.MAX_RETRIES) {
      try {
        // Update currently processing list
        setProgress(prev => ({
          ...prev,
          currentlyProcessing: [...prev.currentlyProcessing, repo.full_name]
        }));

        const analysisResponse = await fetch('/api/analyze/single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: repo.id,
            repoOwner: repo.owner,
            repoName: repo.name,
            force: false
          })
        });
        
        // Remove from currently processing
        setProgress(prev => ({
          ...prev,
          currentlyProcessing: prev.currentlyProcessing.filter(r => r !== repo.full_name)
        }));
        
        if (analysisResponse.ok) {
          return true;
        } else {
          // Parse error response
          let errorMessage = `HTTP ${analysisResponse.status}`;
          try {
            const errorData = await analysisResponse.json();
            errorMessage = errorData.error || errorMessage;
          } catch {}
          
          const { type, retryable } = classifyError(analysisResponse.status, { message: errorMessage });
          
          if (!retryable || retries >= BATCH_CONFIG.MAX_RETRIES) {
            // Add to failed repos
            setProgress(prev => ({
              ...prev,
              failedRepos: [...prev.failedRepos, {
                id: repo.id,
                name: repo.full_name,
                error: errorMessage,
                errorType: type,
                retryable,
                attempts: retries + 1
              }]
            }));
            return false;
          }
          
          // Exponential backoff for retryable errors
          const backoffDelay = BATCH_CONFIG.EXPONENTIAL_BACKOFF_BASE * Math.pow(2, retries);
          console.log(`Retrying ${repo.full_name} after ${backoffDelay}ms (attempt ${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          retries++;
        }
      } catch (error) {
        console.error(`Error analyzing ${repo.full_name}:`, error);
        
        // Remove from currently processing
        setProgress(prev => ({
          ...prev,
          currentlyProcessing: prev.currentlyProcessing.filter(r => r !== repo.full_name)
        }));
        
        const { type, retryable } = classifyError(0, error);
        
        if (retries < BATCH_CONFIG.MAX_RETRIES && retryable) {
          retries++;
          const backoffDelay = BATCH_CONFIG.EXPONENTIAL_BACKOFF_BASE * Math.pow(2, retries - 1);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        } else {
          // Add to failed repos
          setProgress(prev => ({
            ...prev,
            failedRepos: [...prev.failedRepos, {
              id: repo.id,
              name: repo.full_name,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: type,
              retryable,
              attempts: retries + 1
            }]
          }));
          return false;
        }
      }
    }
    
    return false;
  };

  // Process repositories in parallel
  const processRepositoriesInParallel = async (repositories: any[]) => {
    const results: boolean[] = [];
    
    // Process in batches of PARALLEL_WORKERS
    for (let i = 0; i < repositories.length; i += BATCH_CONFIG.PARALLEL_WORKERS) {
      if (shouldStopRef.current) break;
      
      const batch = repositories.slice(i, i + BATCH_CONFIG.PARALLEL_WORKERS);
      
      // Start all workers in parallel
      const promises = batch.map(async (repo, index) => {
        // Stagger the start slightly to avoid thundering herd
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_CONFIG.DELAY_BETWEEN_REPOS * index));
        }
        return processRepository(repo);
      });
      
      // Wait for all workers to complete
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
      // Update progress for each completed repo
      batchResults.forEach((success) => {
        processedCountRef.current++;
        setProgress(prev => {
          const newProcessed = prev.processed + 1;
          return {
            ...prev,
            processed: newProcessed,
            successCount: prev.successCount + (success ? 1 : 0),
            failedCount: prev.failedCount + (success ? 0 : 1),
            estimatedTimeRemaining: updateEstimatedTime(newProcessed, prev.total)
          };
        });
      });
    }
    
    return results;
  };

  const processNextChunk = async (startIndex = 0) => {
    // Check if we should stop
    if (shouldStopRef.current || !batchId) {
      if (shouldStopRef.current) {
        setStatus('completed');
        onComplete();
      }
      return;
    }

    try {
      // First, get the list of repositories to analyze
      const response = await api.triggerBatchAnalysis('visible', false, 30, startIndex, batchId);
      
      // If no repositories need analysis, we're done
      if (!response.repositories || response.repositories.length === 0) {
        if (response.reason) {
          console.log('No repositories to analyze:', response.reason);
        }
        setStatus('completed');
        onComplete();
        return;
      }
      
      // Update total count
      setProgress(prev => ({
        ...prev,
        total: response.total || prev.total,
        currentChunk: response.currentChunk || []
      }));
      
      // Process repositories in parallel
      console.log(`Processing ${response.repositories.length} repositories in parallel (${BATCH_CONFIG.PARALLEL_WORKERS} workers)...`);
      await processRepositoriesInParallel(response.repositories);
      
      // If there are more chunks, process the next one
      if (response.hasMore && response.nextIndex !== null && response.nextIndex !== undefined) {
        // Small delay before next chunk to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        processNextChunk(response.nextIndex as number);
      } else {
        // All chunks processed
        setStatus('completed');
        onComplete();
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
      setStatus('completed');
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleStop = () => {
    shouldStopRef.current = true;
    setStatus('stopping');
    // The next chunk won't be processed due to the ref check
    // Force completion after a short delay
    setTimeout(() => {
      setStatus('completed');
      onComplete();
    }, 500);
  };

  // Retry failed repositories
  const retryFailed = async () => {
    const retryableRepos = progress.failedRepos.filter(r => r.retryable);
    if (retryableRepos.length === 0) return;

    setStatus('running');
    shouldStopRef.current = false;
    
    // Clear failed repos that we're retrying
    setProgress(prev => ({
      ...prev,
      failedRepos: prev.failedRepos.filter(r => !r.retryable),
      failedCount: prev.failedCount - retryableRepos.length,
    }));

    // Convert failed repos back to regular repo format
    const reposToRetry = retryableRepos.map(failed => ({
      id: failed.id,
      full_name: failed.name,
      owner: failed.name.split('/')[0],
      name: failed.name.split('/')[1],
    }));

    await processRepositoriesInParallel(reposToRetry);
    setStatus('completed');
    onComplete();
  };

  // Handle idle state (no active batch)
  if (status === 'idle' && !batchId) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center space-x-2 text-gray-500 dark:text-gray-400">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">No active batch analysis</span>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
          Click "Analyze All Visible Repos" to start a new batch
        </p>
      </div>
    );
  }

  // Running state
  if (status === 'running' || status === 'stopping') {
    const progressPercentage = progress.total > 0 
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {status === 'stopping' ? (
              <StopCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              {status === 'stopping' ? 'Stopping Batch Analysis...' : 'Batch Analysis Running'}
            </span>
            <div className="flex items-center space-x-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
              <Zap className="h-3 w-3" />
              <span>Fast Mode ({BATCH_CONFIG.PARALLEL_WORKERS}x parallel)</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {progressPercentage}% Complete
            </span>
            {status === 'running' && (
              <button
                onClick={handleStop}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Progress Details */}
        <div className="flex items-center justify-between text-sm mt-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">
              {progress.estimatedTimeRemaining || 'Processing...'}
            </span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {progress.processed} / {progress.total} repos
          </span>
        </div>

        {/* Currently Processing */}
        {progress.currentlyProcessing.length > 0 && (
          <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Currently analyzing ({progress.currentlyProcessing.length} in parallel):
            </p>
            <div className="text-xs text-gray-800 dark:text-gray-200 space-y-1">
              {progress.currentlyProcessing.slice(0, 5).map((repo, idx) => (
                <div key={idx} className="truncate flex items-center space-x-1">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span>{repo}</span>
                </div>
              ))}
              {progress.currentlyProcessing.length > 5 && (
                <div className="text-gray-500 dark:text-gray-400">
                  ... and {progress.currentlyProcessing.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success/Failure Count */}
        <div className="flex justify-between text-xs mt-3">
          <span className="text-green-600 dark:text-green-400">
            ✓ {progress.successCount} successful
          </span>
          {progress.failedCount > 0 && (
            <span className="text-red-600 dark:text-red-400">
              ✗ {progress.failedCount} failed
            </span>
          )}
        </div>

        {/* Performance Stats */}
        {progress.processed > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Average speed: {((progress.processed / ((Date.now() - startTimeRef.current) / 1000)) * 60).toFixed(1)} repos/min
          </div>
        )}
      </div>
    );
  }

  // Completed state
  if (status === 'completed') {
    const totalTime = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
    const avgSpeed = totalTime > 0 ? (progress.processed / totalTime * 60).toFixed(1) : '0';
    const retryableCount = progress.failedRepos.filter(r => r.retryable).length;
    
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            Batch Analysis Completed
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Processed {progress.processed} repositories in {Math.floor(totalTime / 60)}m {totalTime % 60}s
        </p>
        {progress.successCount > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            {progress.successCount} successful analyses ({avgSpeed} repos/min)
          </p>
        )}
        {progress.failedCount > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-red-600 dark:text-red-400">
                {progress.failedCount} failed analyses
              </p>
              <button
                onClick={() => setShowFailedDetails(!showFailedDetails)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showFailedDetails ? 'Hide' : 'Show'} details
              </button>
            </div>
            
            {showFailedDetails && progress.failedRepos.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {progress.failedRepos.map((failed, idx) => (
                    <div key={idx} className="flex items-start justify-between">
                      <div className="flex items-center space-x-1 flex-1">
                        <XCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{failed.name}</span>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">
                        {failed.errorType === 'rate_limit' && 'Rate limited'}
                        {failed.errorType === 'not_found' && 'Not found'}
                        {failed.errorType === 'no_readme' && 'No README'}
                        {failed.errorType === 'auth_error' && 'Auth error'}
                        {failed.errorType === 'timeout' && 'Timeout'}
                        {failed.errorType === 'claude_error' && 'Claude API error'}
                        {failed.errorType === 'network' && 'Network error'}
                        {failed.errorType === 'unknown' && 'Unknown error'}
                      </span>
                    </div>
                  ))}
                </div>
                
                {retryableCount > 0 && (
                  <button
                    onClick={retryFailed}
                    className="mt-2 flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Retry {retryableCount} failed repos</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
