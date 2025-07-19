import { useQuery } from '@tanstack/react-query';
import { 
  Zap, 
  Brain, 
  Database
} from 'lucide-react';
import { api } from '@/lib/api';

interface NeuralActivityCenterProps {
  status?: any;
  analysisStats?: any;
}

export default function NeuralActivityCenter({ status, analysisStats }: NeuralActivityCenterProps) {
  // Fetch worker metrics for real-time data with aggressive refresh
  const { data: workerMetrics } = useQuery({
    queryKey: ['worker-metrics'],
    queryFn: api.getWorkerMetrics,
    refetchInterval: 3000, // 3 seconds for most dynamic data
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 1000, // Consider data stale after 1 second
  });

  // Fetch analysis stats with faster refresh
  const { data: realtimeAnalysisStats } = useQuery({
    queryKey: ['analysis-stats-realtime'],
    queryFn: api.getAnalysisStats,
    refetchInterval: 5000, // 5 seconds for analysis progress
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 2000,
  });

  // Fetch status for real-time rate limits
  const { data: realtimeStatus } = useQuery({
    queryKey: ['status-realtime'],
    queryFn: api.getStatus,
    refetchInterval: 10000, // 10 seconds for rate limits
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 5000,
  });

  // Use real-time data sources with fallbacks
  const currentStatus = realtimeStatus || status;
  const currentAnalysisStats = realtimeAnalysisStats || analysisStats;

  // Enhanced API activity calculation with real-time rate limits
  const realtimeRateLimitUsage = currentStatus?.rateLimits?.github 
    ? Math.round(((currentStatus.rateLimits.github.maxTokens - currentStatus.rateLimits.github.availableTokens) / currentStatus.rateLimits.github.maxTokens) * 100)
    : 0;

  const realtimeApiActivity = workerMetrics?.metrics && workerMetrics.metrics.length > 0
    ? workerMetrics.metrics[workerMetrics.metrics.length - 1]?.components?.apiActivity || 0
    : 0;

  // Calculate API burst activity from recent metrics
  const apiBurstActivity = workerMetrics?.metrics && workerMetrics.metrics.length >= 3
    ? Math.max(...workerMetrics.metrics.slice(-3).map(m => m.components.apiActivity))
    : realtimeApiActivity;

  // Enhanced API usage: 30% rate limits + 50% real-time activity + 20% burst detection
  const apiUsage = Math.round(
    (realtimeRateLimitUsage * 0.3) + 
    (realtimeApiActivity * 0.5) + 
    (apiBurstActivity * 0.2)
  );

  // Enhanced analysis progress with real-time data
  const baseAnalysisProgress = currentAnalysisStats?.analysisProgress || 0;
  const aiProcessingActivity = workerMetrics?.metrics && workerMetrics.metrics.length > 0
    ? workerMetrics.metrics[workerMetrics.metrics.length - 1]?.components?.analysisActivity || 0
    : 0;
  
  // Calculate analysis momentum from recent activity
  const analysisMomentum = workerMetrics?.metrics && workerMetrics.metrics.length >= 4
    ? workerMetrics.metrics.slice(-4).reduce((sum, m) => sum + m.components.analysisActivity, 0) / 4
    : aiProcessingActivity;
  
  const analysisProgress = Math.max(baseAnalysisProgress, Math.max(aiProcessingActivity, analysisMomentum));

  // Enhanced queue load with real-time database activity
  const baseQueueLoad = currentAnalysisStats 
    ? Math.round((currentAnalysisStats.remainingRepositories / currentAnalysisStats.totalRepositories) * 100)
    : 0;
  
  const dbActivity = workerMetrics?.metrics && workerMetrics.metrics.length > 0
    ? workerMetrics.metrics[workerMetrics.metrics.length - 1]?.components?.dbActivity || 0
    : 0;

  // Calculate database processing intensity
  const dbIntensity = workerMetrics?.metrics && workerMetrics.metrics.length >= 3
    ? Math.max(...workerMetrics.metrics.slice(-3).map(m => m.components.dbActivity))
    : dbActivity;

  const queueLoad = Math.max(baseQueueLoad, Math.max(dbActivity, dbIntensity));

  // Status indicators
  const getStatusColor = (value: number) => {
    if (value >= 80) return '#ef4444'; // red
    if (value >= 60) return '#f59e0b'; // amber
    if (value >= 30) return '#3b82f6'; // blue
    return '#10b981'; // green
  };

  const getStatusText = (value: number) => {
    if (value >= 80) return 'HIGH LOAD';
    if (value >= 60) return 'ACTIVE';
    if (value >= 30) return 'PROCESSING';
    return 'IDLE';
  };

  return (
    <div className="neural-activity-center">
      <style dangerouslySetInnerHTML={{
        __html: `
        .neural-activity-center {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border: 2px solid rgba(59, 130, 246, 0.4);
          border-radius: 20px;
          padding: 32px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px);
          min-height: 400px;
        }
        
        .neural-activity-center::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
          animation: neural-bg 8s ease-in-out infinite;
        }
        
        @keyframes neural-bg {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .neural-title {
          text-align: center;
          margin-bottom: 32px;
          position: relative;
          z-index: 10;
        }
        
        .neural-title h3 {
          background: linear-gradient(45deg, #3b82f6, #8b5cf6, #10b981);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: neural-title-glow 4s ease-in-out infinite;
          font-size: 1.75rem;
          font-weight: 800;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        
        @keyframes neural-title-glow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .activity-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          position: relative;
          z-index: 5;
        }
        
        .activity-panel {
          background: rgba(30, 41, 59, 0.7);
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          min-height: 280px;
        }
        
        .activity-panel:hover {
          transform: translateY(-4px);
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 20px 40px rgba(59, 130, 246, 0.2);
        }
        
        .activity-panel.api-panel {
          border-color: rgba(59, 130, 246, 0.4);
        }
        
        .activity-panel.api-panel:hover {
          border-color: rgba(59, 130, 246, 0.8);
          box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3);
        }
        
        .activity-panel.analysis-panel {
          border-color: rgba(139, 92, 246, 0.4);
        }
        
        .activity-panel.analysis-panel:hover {
          border-color: rgba(139, 92, 246, 0.8);
          box-shadow: 0 20px 40px rgba(139, 92, 246, 0.3);
        }
        
        .activity-panel.queue-panel {
          border-color: rgba(16, 185, 129, 0.4);
        }
        
        .activity-panel.queue-panel:hover {
          border-color: rgba(16, 185, 129, 0.8);
          box-shadow: 0 20px 40px rgba(16, 185, 129, 0.3);
        }
        
        .panel-header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .panel-icon {
          width: 32px;
          height: 32px;
          margin-right: 12px;
          filter: drop-shadow(0 0 12px currentColor);
          animation: icon-pulse 3s ease-in-out infinite;
        }
        
        @keyframes icon-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px currentColor); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 20px currentColor); }
        }
        
        .panel-title {
          flex: 1;
        }
        
        .panel-name {
          font-size: 1rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .panel-description {
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.8);
          margin: 2px 0 0 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .status-indicator {
          display: flex;
          align-items: center;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
          animation: status-blink 2s ease-in-out infinite;
        }
        
        @keyframes status-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .metric-display {
          text-align: center;
          margin: 20px 0;
        }
        
        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
          text-shadow: 0 0 20px currentColor;
          animation: metric-glow 3s ease-in-out infinite;
        }
        
        @keyframes metric-glow {
          0%, 100% { text-shadow: 0 0 20px currentColor; }
          50% { text-shadow: 0 0 30px currentColor, 0 0 40px currentColor; }
        }
        
        .metric-label {
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.9);
          margin: 4px 0 0 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        
        .metric-details {
          margin-top: 16px;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.75rem;
        }
        
        .detail-label {
          color: rgba(148, 163, 184, 0.8);
        }
        
        .detail-value {
          color: #ffffff;
          font-weight: 600;
        }
        
        .progress-bar {
          width: 100%;
          height: 6px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 12px;
        }
        
        .progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease;
          animation: progress-flow 3s ease-in-out infinite;
        }
        
        @keyframes progress-flow {
          0%, 100% { box-shadow: 0 0 10px currentColor; }
          50% { box-shadow: 0 0 20px currentColor, 0 0 30px currentColor; }
        }
        
        .api-fill {
          background: linear-gradient(90deg, #3b82f6, #1d4ed8);
        }
        
        .analysis-fill {
          background: linear-gradient(90deg, #8b5cf6, #7c3aed);
        }
        
        .queue-fill {
          background: linear-gradient(90deg, #10b981, #059669);
        }
        
        .neural-connections {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          z-index: 1;
        }
        
        .connection-line {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
          animation: data-flow 4s linear infinite;
        }
        
        @keyframes data-flow {
          0% { opacity: 0; transform: scaleX(0); }
          50% { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0; transform: scaleX(0); }
        }
        
        .matrix-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px),
            linear-gradient(180deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px);
          background-size: 30px 30px;
          animation: matrix-scroll 15s linear infinite;
          z-index: 0;
        }
        
        @keyframes matrix-scroll {
          0% { transform: translate(0, 0); }
          100% { transform: translate(30px, 30px); }
        }
        
        .data-particles {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1;
        }
        
        .particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
          animation: particle-float 6s linear infinite;
        }
        
        @keyframes particle-float {
          0% { opacity: 0; transform: translateY(100px); }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-100px); }
        }
        `
      }} />

      {/* Matrix Overlay */}
      <div className="matrix-overlay" />

      {/* Data Particles */}
      <div className="data-particles">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${10 + i * 7}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Neural Connections */}
      <div className="neural-connections">
        <div className="connection-line" style={{
          left: '33%',
          width: '34%',
          animationDelay: '0s'
        }} />
        <div className="connection-line" style={{
          left: '0%',
          width: '33%',
          animationDelay: '2s'
        }} />
        <div className="connection-line" style={{
          left: '67%',
          width: '33%',
          animationDelay: '1s'
        }} />
      </div>

      {/* Title */}
      <div className="neural-title">
        <h3>⚡ Neural Activity Command Center</h3>
      </div>

      {/* Activity Grid */}
      <div className="activity-grid">
        {/* API Nexus Panel */}
        <div className="activity-panel api-panel">
          <div className="panel-header">
            <div className="panel-icon">
              <Zap className="w-full h-full text-blue-400" />
            </div>
            <div className="panel-title">
              <h4 className="panel-name">API Nexus</h4>
              <p className="panel-description">External Data Acquisition</p>
            </div>
            <div className="status-indicator">
              <div 
                className="status-dot" 
                style={{ backgroundColor: getStatusColor(apiUsage) }}
              />
              <span style={{ color: getStatusColor(apiUsage) }}>
                {getStatusText(apiUsage)}
              </span>
            </div>
          </div>

          <div className="metric-display">
            <h2 className="metric-value text-blue-400">{apiUsage}%</h2>
            <p className="metric-label">Activity Level</p>
          </div>

          <div className="metric-details">
            <div className="detail-row">
              <span className="detail-label">Rate Limits</span>
              <span className="detail-value">{realtimeRateLimitUsage}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Real-time API</span>
              <span className="detail-value">{Math.round(realtimeApiActivity)}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">GitHub Tokens</span>
              <span className="detail-value">
                {status?.rateLimits?.github?.availableTokens || 0}/{status?.rateLimits?.github?.maxTokens || 0}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Claude Tokens</span>
              <span className="detail-value">
                {status?.rateLimits?.claude?.availableTokens || 0}/{status?.rateLimits?.claude?.maxTokens || 0}
              </span>
            </div>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-fill api-fill" 
              style={{ width: `${apiUsage}%` }}
            />
          </div>
        </div>

        {/* Analysis Core Panel */}
        <div className="activity-panel analysis-panel">
          <div className="panel-header">
            <div className="panel-icon">
              <Brain className="w-full h-full text-purple-400" />
            </div>
            <div className="panel-title">
              <h4 className="panel-name">Analysis Core</h4>
              <p className="panel-description">Neural Processing Intelligence</p>
            </div>
            <div className="status-indicator">
              <div 
                className="status-dot" 
                style={{ backgroundColor: getStatusColor(analysisProgress) }}
              />
              <span style={{ color: getStatusColor(analysisProgress) }}>
                {getStatusText(analysisProgress)}
              </span>
            </div>
          </div>

          <div className="metric-display">
            <h2 className="metric-value text-purple-400">{Math.round(analysisProgress)}%</h2>
            <p className="metric-label">Processing Power</p>
          </div>

          <div className="metric-details">
            <div className="detail-row">
              <span className="detail-label">Base Progress</span>
              <span className="detail-value">{Math.round(baseAnalysisProgress)}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">AI Activity</span>
              <span className="detail-value">{Math.round(aiProcessingActivity)}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Analyzed Repos</span>
              <span className="detail-value">
                {analysisStats?.analyzedRepositories || 0}/{analysisStats?.totalRepositories || 0}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Neural State</span>
              <span className="detail-value">
                {analysisProgress > 50 ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-fill analysis-fill" 
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
        </div>

        {/* Queue Matrix Panel */}
        <div className="activity-panel queue-panel">
          <div className="panel-header">
            <div className="panel-icon">
              <Database className="w-full h-full text-green-400" />
            </div>
            <div className="panel-title">
              <h4 className="panel-name">Queue Matrix</h4>
              <p className="panel-description">Repository Processing Pipeline</p>
            </div>
            <div className="status-indicator">
              <div 
                className="status-dot" 
                style={{ backgroundColor: getStatusColor(queueLoad) }}
              />
              <span style={{ color: getStatusColor(queueLoad) }}>
                {getStatusText(queueLoad)}
              </span>
            </div>
          </div>

          <div className="metric-display">
            <h2 className="metric-value text-green-400">{queueLoad}%</h2>
            <p className="metric-label">Pipeline Load</p>
          </div>

          <div className="metric-details">
            <div className="detail-row">
              <span className="detail-label">Queue Load</span>
              <span className="detail-value">{baseQueueLoad}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">DB Activity</span>
              <span className="detail-value">{Math.round(dbActivity)}%</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Remaining</span>
              <span className="detail-value">
                {analysisStats?.remainingRepositories || 0} repos
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Pipeline State</span>
              <span className="detail-value">
                {queueLoad > 30 ? 'PROCESSING' : 'READY'}
              </span>
            </div>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-fill queue-fill" 
              style={{ width: `${queueLoad}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
