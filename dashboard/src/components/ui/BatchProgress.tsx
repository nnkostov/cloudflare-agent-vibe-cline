import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, Loader2, AlertCircle, StopCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface BatchProgressProps {
  batchId: string | null;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function BatchProgress({ batchId, onComplete, onError }: BatchProgressProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'stopping' | 'completed'>('idle');
  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    currentChunk: [] as string[],
    successCount: 0,
    failedCount: 0
  });
  
  // Use a ref to track if we should stop
  const shouldStopRef = useRef(false);

  useEffect(() => {
    // If no batchId, set status to idle
    if (!batchId) {
      setStatus('idle');
      setProgress({
        processed: 0,
        total: 0,
        currentChunk: [],
        successCount: 0,
        failedCount: 0
      });
      shouldStopRef.current = false;
      return;
    }

    // When batchId is set, start processing
    setStatus('running');
    shouldStopRef.current = false;
    processNextChunk();
  }, [batchId]);

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
      const response = await api.triggerBatchAnalysis('visible', false, 5, startIndex, batchId);
      
      // Update progress with null checks
      setProgress(prev => ({
        processed: prev.processed + (response.processed || 0),
        total: response.total || prev.total,
        currentChunk: response.currentChunk || [],
        successCount: prev.successCount + (response.chunkInfo?.actualProcessed || 0),
        failedCount: prev.failedCount + (response.chunkInfo?.failed || 0)
      }));

      // If there are more chunks, process the next one
      if (response.hasMore && response.nextIndex !== null && response.nextIndex !== undefined) {
        // Small delay before next chunk
        setTimeout(() => {
          // Re-check status in the timeout
          setStatus(prevStatus => {
            if (prevStatus !== 'stopping') {
              processNextChunk(response.nextIndex as number);
            }
            return prevStatus;
          });
        }, 1000);
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
            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Progress Details */}
        <div className="flex items-center justify-between text-sm mt-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">
              Processing chunk...
            </span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {progress.processed} / {progress.total} repos
          </span>
        </div>

        {/* Current Chunk Info */}
        {progress.currentChunk.length > 0 && (
          <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Currently processing:
            </p>
            <div className="text-xs text-gray-800 dark:text-gray-200 space-y-1">
              {progress.currentChunk.slice(0, 3).map((repo, idx) => (
                <div key={idx} className="truncate">
                  • {repo}
                </div>
              ))}
              {progress.currentChunk.length > 3 && (
                <div className="text-gray-500 dark:text-gray-400">
                  ... and {progress.currentChunk.length - 3} more
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
      </div>
    );
  }

  // Completed state
  if (status === 'completed') {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            Batch Analysis Completed
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Processed {progress.processed} repositories
        </p>
        {progress.successCount > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            {progress.successCount} successful analyses
          </p>
        )}
        {progress.failedCount > 0 && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {progress.failedCount} failed analyses
          </p>
        )}
      </div>
    );
  }

  return null;
}
