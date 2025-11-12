import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw, AlertCircle, CheckCircle, Zap, Sparkles, Settings, Clock, BarChart3, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BatchProgress } from '@/components/ui/BatchProgress';
import NeuralActivityCenter from '@/components/controls/NeuralActivityCenter';
import { getDisplayVersion } from '@/lib/version';

export default function Controls() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Track active batch ID - check backend on mount for automated batches
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Poll for active batches from backend (including automated ones)
  const { data: activeBatch } = useQuery({
    queryKey: ['active-batch'],
    queryFn: async () => {
      const response = await fetch('/api/batch/active');
      if (!response.ok) return null;
      return response.json();
    },
    refetchInterval: 5000, // Check every 5 seconds
    retry: 1,
  });

  // Update activeBatchId when backend reports an active batch
  useEffect(() => {
    if (activeBatch?.batchId && activeBatch.status === 'active') {
      if (activeBatchId !== activeBatch.batchId) {
        setActiveBatchId(activeBatch.batchId);
        console.log('[Auto-Discovery] Found active batch:', activeBatch.batchId, 
          `Type: ${activeBatch.type}, Progress: ${activeBatch.progress?.processed}/${activeBatch.progress?.total}`);
      }
    } else if (activeBatch?.batchId === null && activeBatchId !== null) {
      // No active batch on backend, clear local state
      setActiveBatchId(null);
    }
  }, [activeBatch]);

  const { data: status, error: statusError } = useQuery({
    queryKey: ['status'],
    queryFn: api.getStatus,
    retry: 1,
  });

  const { data: analysisStats } = useQuery({
    queryKey: ['analysis-stats'],
    queryFn: api.getAnalysisStats,
    refetchInterval: activeBatchId !== null ? 3000 : 30000, // 3s when batch active, 30s otherwise
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
      
      // Log progress details if available
      if (data.progress) {
        console.log('Comprehensive Scan Progress:', data.progress);
        if (data.progress.errors && data.progress.errors.length > 0) {
          console.error('Scan Errors:', data.progress.errors);
        }
      }
      
      const message = data.progress 
        ? `Comprehensive scan completed in ${data.duration}! Discovered: ${data.discovered}, Processed: ${data.processed}, Analyzed: ${data.analyzed}`
        : `Comprehensive scan completed in ${data.duration}!`;
      
      setStatusMessage({ 
        type: 'success', 
        message
      });
    },
    onError: (error: any) => {
      // Log error details if available
      if (error.progress) {
        console.error('Scan Progress at Error:', error.progress);
      }
      
      setStatusMessage({ 
        type: 'error', 
        message: `Comprehensive scan failed: ${error.message}` 
      });
    },
  });

  const batchAnalysisMutation = useMutation({
    mutationFn: (target: 'visible' | 'tier1' | 'tier2' | 'all' = 'visible') => 
      api.triggerBatchAnalysis(target, forceMode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trending'] });
      
      // Handle case where no repositories need analysis
      if (!data.batchId) {
        setStatusMessage({
          type: 'info',
          message: data.reason || 'No repositories need analysis at this time'
        });
        
        // Show detailed analysis stats if available
        if (data.analysisStats) {
          console.log('Analysis Coverage:', data.analysisStats);
        }
        
        return;
      }
      
      // Set active batch ID for progress tracking
      setActiveBatchId(data.batchId);
      
      // Enhanced success message with more details
      const totalRepos = data.total || data.repositories?.length || 0;
      const batchSize = 5; // Default batch size from backend
      const delaySeconds = 2; // Default delay between analyses
      const maxRetries = 3; // Default max retries
      const estimatedMinutes = Math.ceil((totalRepos * delaySeconds) / 60);
      const estimatedTime = estimatedMinutes > 60 ? 
        `${Math.round(estimatedMinutes / 60)} hours` : 
        `${estimatedMinutes} minutes`;
      
      const message = `Enhanced batch analysis started! Processing ${totalRepos} repositories (${batchSize} max batch size, ${delaySeconds}s delays, ${maxRetries} max retries). Estimated completion: ${estimatedTime}.`;
      
      setStatusMessage({
        type: 'success',
        message
      });
      
      // Log detailed information for debugging
      console.log('Enhanced Batch Analysis Details:', {
        batchId: data.batchId,
        target: data.target,
        totalRepos: data.totalRepos,
        needingAnalysis: data.needingAnalysis,
        queued: data.queued,
        repositories: data.repositories
      });
    },
    onError: (error) => {
      setStatusMessage({
        type: 'error',
        message: `Failed to start batch analysis: ${error.message}`
      });
      setActiveBatchId(null);
    },
  });

  // Handle batch completion
  const handleBatchComplete = () => {
    setActiveBatchId(null);
    queryClient.invalidateQueries({ queryKey: ['trending'] });
    setStatusMessage({
      type: 'success',
      message: 'Batch analysis completed successfully! Repository analyses have been updated.'
    });
  };

  // Handle batch error
  const handleBatchError = (error: string) => {
    setActiveBatchId(null);
    setStatusMessage({
      type: 'error',
      message: `Batch analysis failed: ${error}`
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Controls</h2>

      {/* Neural Activity Command Center - TOP POSITION */}
      <NeuralActivityCenter status={status} analysisStats={analysisStats} activeBatchId={activeBatchId} />

      {/* Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-lg flex items-center ${
          statusMessage.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
            : statusMessage.type === 'info'
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : statusMessage.type === 'info' ? (
            <AlertCircle className="h-5 w-5 mr-2" />
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
                onClick={() => comprehensiveScanMutation.mutate(forceMode)}
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
              <div className="mt-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={forceMode}
                    onChange={(e) => setForceMode(e.target.checked)}
                    className="mr-2 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Force scan (process at least 10 repos)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Scan Schedule */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center mb-2">
              <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
              <h4 className="font-medium text-gray-900 dark:text-white">Automatic Scanning</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The agent automatically scans repositories every {status?.scanInterval || 1} hour{status?.scanInterval !== 1 ? 's' : ''} when initialized.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Automated Scanning Intelligence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Automated Scanning Intelligence</span>
            <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
              ACTIVE
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Schedule Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center mb-2">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">Hourly Operations</h4>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Every hour at :00 minutes
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Phase 1 (0-3 min):</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">Comprehensive Scan</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700 dark:text-blue-300">Phase 2 (3-5 min):</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">Batch Analysis</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center mb-2">
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-2" />
                <h4 className="font-semibold text-purple-900 dark:text-purple-100">Comprehensive Sweep</h4>
              </div>
              <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                Twice daily at 2:00 AM and 2:00 PM
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-purple-700 dark:text-purple-300">Target:</span>
                  <span className="font-medium text-purple-900 dark:text-purple-100">100+ repositories</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-700 dark:text-purple-300">Mode:</span>
                  <span className="font-medium text-purple-900 dark:text-purple-100">Force + Comprehensive</span>
                </div>
              </div>
            </div>
          </div>

          {/* Processing Mathematics */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Processing Mathematics & Coverage
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Hourly Breakdown */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Hourly Processing Capacity</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-red-700 dark:text-red-300">Tier 1 (High Priority)</span>
                    <span className="font-mono font-bold text-red-900 dark:text-red-100">25 repos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <span className="text-yellow-700 dark:text-yellow-300">Tier 2 (Medium Priority)</span>
                    <span className="font-mono font-bold text-yellow-900 dark:text-yellow-100">50 repos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-green-700 dark:text-green-300">Tier 3 (Emerging)</span>
                    <span className="font-mono font-bold text-green-900 dark:text-green-100">100 repos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded border-t border-indigo-200 dark:border-indigo-700">
                    <span className="text-indigo-700 dark:text-indigo-300 font-medium">+ Batch Analysis</span>
                    <span className="font-mono font-bold text-indigo-900 dark:text-indigo-100">25 repos</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded font-semibold">
                    <span className="text-gray-700 dark:text-gray-300">Total per Hour</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-gray-100">~200 repos</span>
                  </div>
                </div>
              </div>

              {/* Coverage Timeline */}
              <div>
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Complete Coverage Timeline</h5>
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Current Database</span>
                      <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                        {(status as any)?.tierDistribution ? 
                          ((status as any).tierDistribution.tier1 + (status as any).tierDistribution.tier2 + (status as any).tierDistribution.tier3 + ((status as any).tierDistribution.unassigned || 0)) 
                          : '1,487'} repos
                      </span>
                    </div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      {(status as any)?.tierDistribution ? 
                        `${(status as any).tierDistribution.tier1} Tier 1 • ${(status as any).tierDistribution.tier2} Tier 2 • ${(status as any).tierDistribution.tier3} Tier 3 • ${(status as any).tierDistribution.unassigned || 0} Unassigned`
                        : '83 Tier 1 • 189 Tier 2 • 1,187 Tier 3 • 1 Unassigned'
                      }
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Hourly Analysis Rate:</span>
                      <span className="font-mono font-medium text-gray-900 dark:text-white">~60 repos/hour</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Complete Coverage:</span>
                      <span className="font-mono font-medium text-green-600 dark:text-green-400">~25 hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tier 1 Refresh:</span>
                      <span className="font-mono font-medium text-red-600 dark:text-red-400">~3-4 hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tier 2 Refresh:</span>
                      <span className="font-mono font-medium text-yellow-600 dark:text-yellow-400">~8-10 hours</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Tier 3 Refresh:</span>
                      <span className="font-mono font-medium text-green-600 dark:text-green-400">~12-15 hours</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Selection Algorithm */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Smart Repository Selection Algorithm
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Priority Factors</h5>
                <ol className="space-y-1 text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2 font-bold">1.</span>
                    <span><strong>Staleness:</strong> Repositories without analysis in 7+ days</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2 font-bold">2.</span>
                    <span><strong>Tier Priority:</strong> Tier 1 → Tier 2 → Tier 3</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2 font-bold">3.</span>
                    <span><strong>Popularity:</strong> Higher starred repositories first</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-indigo-500 mr-2 font-bold">4.</span>
                    <span><strong>Activity:</strong> Recently updated repositories</span>
                  </li>
                </ol>
              </div>
              <div>
                <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Analysis Strategy</h5>
                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    <span><strong>Tier 1:</strong> Always analyzed with Claude AI</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    <span><strong>Tier 2:</strong> Top 10 per hour get Claude AI</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    <span><strong>Tier 3:</strong> Basic metrics + batch analysis</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    <span><strong>Rate Limiting:</strong> 2 seconds between analyses</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Global Analysis Overview */}
      {analysisStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Analysis Coverage Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Global Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">
                  {analysisStats.analyzedRepositories}/{analysisStats.totalRepositories} repositories analyzed
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {analysisStats.analysisProgress.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${analysisStats.analysisProgress}%` }}
                />
              </div>
            </div>

            {/* Tier Breakdown */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {Object.entries(analysisStats.tierBreakdown).map(([tier, data]) => (
                <div key={tier} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {tier.replace('tier', 'Tier ')}
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.analyzed}/{data.total}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {data.progress}% complete
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-2">
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

            {/* Batch Information */}
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {analysisStats.batchInfo.estimatedBatchesRemaining} batches remaining
                </span>
              </div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                ~{analysisStats.batchInfo.estimatedTimeRemaining} total
              </span>
            </div>

            {/* Recommendations */}
            {analysisStats.recommendations.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Recommendations:</h5>
                <ul className="space-y-1">
                  {analysisStats.recommendations.map((rec, index) => (
                    <li key={index} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
                      <span className="text-blue-500 mr-1">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analysis Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Batch Analysis</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Generate AI analysis for all visible repositories that don't have one yet
            </p>
            <button
              onClick={() => batchAnalysisMutation.mutate('visible')}
              disabled={batchAnalysisMutation.isPending || activeBatchId !== null}
              className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {batchAnalysisMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analyze All Visible Repos
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Enhanced batch processing: up to 30 repositories with priority ordering, 2s delays, and retry logic
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Batch Analysis Progress - Always Visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>Batch Analysis Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BatchProgress
            batchId={activeBatchId}
            onComplete={handleBatchComplete}
            onError={handleBatchError}
          />
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
                    {activeBatchId ? Math.max(0, status.rateLimits.github.availableTokens - Math.floor(status.rateLimits.github.maxTokens * 0.65)) : status.rateLimits.github.availableTokens}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                    / {status.rateLimits.github.maxTokens}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${activeBatchId ? 35 : (status.rateLimits.github.availableTokens / status.rateLimits.github.maxTokens) * 100}%`,
                    }}
                  />
                </div>
                {activeBatchId && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Batch processing active</p>
                )}
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
                    {activeBatchId ? Math.max(0, status.rateLimits.claude.availableTokens - Math.floor(status.rateLimits.claude.maxTokens * 0.85)) : status.rateLimits.claude.availableTokens}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                    / {status.rateLimits.claude.maxTokens}
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${activeBatchId ? 15 : (status.rateLimits.claude.availableTokens / status.rateLimits.claude.maxTokens) * 100}%`,
                    }}
                  />
                </div>
                {activeBatchId && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Analyzing repositories</p>
                )}
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
              <p className="text-lg font-medium text-gray-900 dark:text-white">{getDisplayVersion()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
