import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader2, BarChart3, Target } from 'lucide-react';
import { api } from '@/lib/api';

interface BatchProgressProps {
  batchId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  currentRepository: string | null;
  startTime: number;
  estimatedCompletion: number | null;
}

interface AnalysisStats {
  timestamp: string;
  totalRepositories: number;
  analyzedRepositories: number;
  remainingRepositories: number;
  analysisProgress: number;
  tierBreakdown: {
    tier1: { total: number; analyzed: number; remaining: number; progress: number };
    tier2: { total: number; analyzed: number; remaining: number; progress: number };
    tier3: { total: number; analyzed: number; remaining: number; progress: number };
  };
  batchInfo: {
    batchSize: number;
    estimatedBatchesRemaining: number;
    estimatedTimeRemaining: string;
  };
  recommendations: string[];
}

export function BatchProgress({ batchId, onComplete, onError }: BatchProgressProps) {
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [status, setStatus] = useState<'running' | 'completed' | 'failed' | 'not_found'>('running');
  const [error, setError] = useState<string | null>(null);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);

  useEffect(() => {
    let intervalId: number;

    const pollProgress = async () => {
      try {
        // Poll both batch progress and global analysis stats
        const [batchResponse, statsResponse] = await Promise.all([
          api.getBatchAnalysisStatus(batchId),
          api.getAnalysisStats()
        ]);
        
        setStatus(batchResponse.status);
        setProgress(batchResponse.progress || null);
        setAnalysisStats(statsResponse);
        
        if (batchResponse.error) {
          setError(batchResponse.error);
        }

        if (batchResponse.status === 'completed') {
          clearInterval(intervalId);
          onComplete();
        } else if (batchResponse.status === 'failed' || batchResponse.status === 'not_found') {
          clearInterval(intervalId);
          onError(batchResponse.error || `Batch ${batchResponse.status}`);
        }
      } catch (err) {
        console.error('Error polling batch progress:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    // Poll every 3 seconds
    intervalId = setInterval(pollProgress, 3000);
    
    // Initial poll
    pollProgress();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [batchId, onComplete, onError]);

  if (!progress && status === 'running') {
    return (
      <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Initializing batch analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">Error: {error}</span>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  const progressPercentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const elapsedTime = Math.round((Date.now() - progress.startTime) / 1000);
  const estimatedTotal = progress.estimatedCompletion ? Math.round((progress.estimatedCompletion - progress.startTime) / 1000) : null;

  return (
    <div className="space-y-4">
      {/* Global Analysis Overview */}
      {analysisStats && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">Global Analysis Progress</span>
          </div>
          
          {/* Global Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">
                {analysisStats.analyzedRepositories}/{analysisStats.totalRepositories} repositories analyzed
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {analysisStats.analysisProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysisStats.analysisProgress}%` }}
              />
            </div>
          </div>

          {/* Tier Breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {Object.entries(analysisStats.tierBreakdown).map(([tier, data]) => (
              <div key={tier} className="text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {tier.replace('tier', 'Tier ')}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {data.analyzed}/{data.total}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      tier === 'tier1' ? 'bg-red-500' :
                      tier === 'tier2' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${data.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Batch Info */}
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Target className="h-4 w-4" />
              <span>{analysisStats.batchInfo.estimatedBatchesRemaining} batches remaining</span>
            </div>
            <span>~{analysisStats.batchInfo.estimatedTimeRemaining} total</span>
          </div>
        </div>
      )}

      {/* Current Batch Progress */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {status === 'completed' ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : status === 'failed' ? (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            )}
            <span className="font-medium text-gray-900 dark:text-white">
              Current Batch Progress
            </span>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {progressPercentage}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
          <div
            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Progress Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Total:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">{progress.total}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Completed:</span>
            <span className="ml-1 font-medium text-green-600 dark:text-green-400">{progress.completed}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Failed:</span>
            <span className="ml-1 font-medium text-red-600 dark:text-red-400">{progress.failed}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Elapsed:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">{elapsedTime}s</span>
          </div>
        </div>

        {/* Current Repository */}
        {progress.currentRepository && 
         typeof progress.currentRepository === 'string' && 
         progress.currentRepository.trim() !== '' && 
         progress.currentRepository !== '0' &&
         !progress.currentRepository.match(/^\d+$/) && (
          <div className="flex items-center space-x-2 text-sm mt-3">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">Currently analyzing:</span>
            <span className="font-medium text-gray-900 dark:text-white">{progress.currentRepository}</span>
          </div>
        )}

        {/* Estimated Completion */}
        {status === 'running' && progress.completed > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {(() => {
              const avgTimePerRepo = elapsedTime / progress.completed;
              const estimatedTotalTime = avgTimePerRepo * progress.total;
              const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
              const remainingMinutes = Math.round(remainingTime / 60);
              
              if (remainingMinutes > 60) {
                const hours = Math.floor(remainingMinutes / 60);
                const mins = remainingMinutes % 60;
                return <span>Estimated completion: {hours}h {mins}m remaining</span>;
              } else if (remainingMinutes > 0) {
                return <span>Estimated completion: {remainingMinutes}m remaining</span>;
              } else {
                return <span>Estimated completion: Less than 1m remaining</span>;
              }
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
