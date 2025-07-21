import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, StopCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface BatchProgressProps {
  batchId: string | null;
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

export function BatchProgress({ batchId, onComplete, onError }: BatchProgressProps) {
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'not_found'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    // If no batchId, set status to idle
    if (!batchId) {
      setStatus('idle');
      setProgress(null);
      setError(null);
      return;
    }

    let intervalId: number;

    const pollProgress = async () => {
      try {
        const batchResponse = await api.getBatchAnalysisStatus(batchId);
        
        setStatus(batchResponse.status);
        setProgress(batchResponse.progress || null);
        
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

  const handleStopBatch = async () => {
    if (!batchId || isStopping) return;
    
    setIsStopping(true);
    try {
      await api.stopBatchAnalysis(batchId);
      setStatus('failed');
      onError('Batch analysis stopped by user');
    } catch (err) {
      console.error('Error stopping batch:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop batch');
    } finally {
      setIsStopping(false);
    }
  };

  return (
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

        {/* Stop Analysis Button */}
        {status === 'running' && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleStopBatch}
              disabled={isStopping}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors duration-200"
            >
              {isStopping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Stopping...</span>
                </>
              ) : (
                <>
                  <StopCircle className="h-4 w-4" />
                  <span>Stop Analysis</span>
                </>
              )}
            </button>
          </div>
        )}
    </div>
  );
}
