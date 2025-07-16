import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw, Settings, Zap, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function Controls() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: status, error: statusError } = useQuery({
    queryKey: ['status'],
    queryFn: api.getStatus,
    retry: 1,
  });

  const initAgentMutation = useMutation({
    mutationFn: api.initializeAgent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['status'] });
      setStatusMessage({ 
        type: 'success', 
        message: `Agent initialized! Next run scheduled for ${new Date(data.nextRun).toLocaleString()}` 
      });
    },
    onError: (error) => {
      setStatusMessage({ 
        type: 'error', 
        message: `Failed to initialize agent: ${error.message}` 
      });
    },
  });

  const scanMutation = useMutation({
    mutationFn: api.triggerScan,
    onMutate: () => {
      setIsScanning(true);
      setStatusMessage(null);
    },
    onSettled: () => setIsScanning(false),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trending'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      setStatusMessage({ 
        type: 'success', 
        message: `Scan completed! Found ${data.repositoriesFound} repositories.` 
      });
    },
    onError: (error) => {
      setStatusMessage({ 
        type: 'error', 
        message: `Scan failed: ${error.message}` 
      });
    },
  });

  const comprehensiveScanMutation = useMutation({
    mutationFn: api.triggerComprehensiveScan,
    onMutate: () => {
      setIsScanning(true);
      setStatusMessage(null);
    },
    onSettled: () => setIsScanning(false),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trending'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-report'] });
      setStatusMessage({ 
        type: 'success', 
        message: `Comprehensive scan completed in ${data.duration}!` 
      });
    },
    onError: (error) => {
      setStatusMessage({ 
        type: 'error', 
        message: `Comprehensive scan failed: ${error.message}` 
      });
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Controls</h2>

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-lg flex items-center ${
          statusMessage.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2" />
          )}
          <span className="text-sm font-medium">{statusMessage.message}</span>
        </div>
      )}

      {/* Connection Error */}
      {statusError && !status && (
        <div className="p-4 rounded-lg flex items-center bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="text-sm font-medium">
            Unable to connect to the worker API. Please check if the worker is deployed and accessible.
          </span>
        </div>
      )}

      {/* Agent Status */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Status</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {status?.status === 'ok' ? 'Active' : 'Inactive'}
              </p>
            </div>
            <button
              onClick={() => initAgentMutation.mutate()}
              disabled={initAgentMutation.isPending}
              className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {initAgentMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Initialize Agent
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Scan Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quick Scan</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Scan for trending AI/ML repositories
              </p>
              <button
                onClick={() => scanMutation.mutate({})}
                disabled={scanMutation.isPending || isScanning}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {scanMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Run Quick Scan
              </button>
            </div>

            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Comprehensive Scan</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Full tiered scan with enhanced metrics
              </p>
              <button
                onClick={() => comprehensiveScanMutation.mutate()}
                disabled={comprehensiveScanMutation.isPending || isScanning}
                className="w-full flex items-center justify-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {comprehensiveScanMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4 mr-2" />
                )}
                Run Comprehensive Scan
              </button>
            </div>
          </div>

          {/* Scan Schedule */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center mb-2">
              <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
              <h4 className="font-medium text-gray-900 dark:text-white">Automatic Scanning</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The agent automatically scans repositories every 6 hours when initialized.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits */}
      {status?.rateLimits && (
        <Card>
          <CardHeader>
            <CardTitle>API Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub API
                </h4>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {status.rateLimits.github.availableTokens}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                    / {status.rateLimits.github.maxTokens}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(status.rateLimits.github.availableTokens / status.rateLimits.github.maxTokens) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub Search
                </h4>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {status.rateLimits.githubSearch.availableTokens}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                    / {status.rateLimits.githubSearch.maxTokens}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${(status.rateLimits.githubSearch.availableTokens / status.rateLimits.githubSearch.maxTokens) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Claude API
                </h4>
                <div className="flex items-baseline">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {status.rateLimits.claude.availableTokens}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                    / {status.rateLimits.claude.maxTokens}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{
                      width: `${(status.rateLimits.claude.availableTokens / status.rateLimits.claude.maxTokens) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Environment</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {status?.environment || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Worker URL</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white truncate">
                {window.location.hostname}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Last Updated</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Version</p>
              <p className="text-lg font-medium text-gray-900 dark:text-white">v1.0.0</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
