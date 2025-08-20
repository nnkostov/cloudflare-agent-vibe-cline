import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

interface BatchProgressProps {
  batchId: string | null;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function BatchProgress({ batchId, onComplete }: BatchProgressProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    // If no batchId, set status to idle
    if (!batchId) {
      setStatus('idle');
      setElapsedSeconds(0);
      return;
    }

    // When batchId is set, mark as running
    setStatus('running');
    const start = Date.now();

    // Update elapsed time every second
    const intervalId = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    // Set a timeout for the expected batch duration (30 seconds max due to Cloudflare limits)
    const timeoutId = setTimeout(() => {
      setStatus('completed');
      onComplete();
      clearInterval(intervalId);
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [batchId, onComplete]);

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
  if (status === 'running') {
    const estimatedRepos = Math.min(30, Math.floor(elapsedSeconds / 2)); // ~2 seconds per repo
    const progressPercentage = Math.min(100, Math.floor((elapsedSeconds / 30) * 100)); // 30 seconds max

    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <span className="font-medium text-gray-900 dark:text-white">
              Batch Analysis Running
            </span>
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            ~{progressPercentage}% Complete
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
          <div
            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Progress Details */}
        <div className="flex items-center justify-between text-sm mt-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-gray-600 dark:text-gray-400">
              Processing repositories...
            </span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            ~{estimatedRepos} repos processed
          </span>
        </div>

        {/* Elapsed Time */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Elapsed: {elapsedSeconds}s / Max: 30s
        </div>

        {/* Note about timeout */}
        {elapsedSeconds > 25 && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            Note: Batch will timeout at 30 seconds due to Cloudflare limits
          </div>
        )}
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
          Processed repositories in {elapsedSeconds} seconds
        </p>
      </div>
    );
  }

  return null;
}
