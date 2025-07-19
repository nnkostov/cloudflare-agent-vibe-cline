import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Trophy,
  AlertCircle,
  FileText,
  Settings,
  Github,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Overview', href: '/overview', icon: LayoutDashboard },
  { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
  { name: 'Alerts', href: '/alerts', icon: AlertCircle },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Controls', href: '/controls', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [, setPulse] = useState(0);

  // Fetch real system data with faster refresh rates
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: api.getStatus,
    refetchInterval: 10000, // Refresh every 10 seconds for rate limits
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 5000,
  });

  const { data: analysisStats } = useQuery({
    queryKey: ['analysis-stats'],
    queryFn: api.getAnalysisStats,
    refetchInterval: 5000, // Refresh every 5 seconds for analysis progress
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 2000,
  });

  const { data: workerMetrics } = useQuery({
    queryKey: ['worker-metrics'],
    queryFn: api.getWorkerMetrics,
    refetchInterval: 3000, // Refresh every 3 seconds for most dynamic data
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 1000,
  });


  // Calculate hybrid API activity (rate limits + real-time activity)
  const rateLimitUsage = status?.rateLimits?.github 
    ? Math.round(((status.rateLimits.github.maxTokens - status.rateLimits.github.availableTokens) / status.rateLimits.github.maxTokens) * 100)
    : 0;

  // Get real-time API activity from worker metrics
  const realtimeApiActivity = workerMetrics?.metrics && workerMetrics.metrics.length > 0
    ? workerMetrics.metrics[workerMetrics.metrics.length - 1]?.components?.apiActivity || 0
    : 0;

  // Hybrid API usage calculation (40% rate limits + 60% real-time activity)
  const apiUsage = Math.round((rateLimitUsage * 0.4) + (realtimeApiActivity * 0.6));

  // Enhanced analysis progress (existing + AI processing activity)
  const baseAnalysisProgress = analysisStats?.analysisProgress || 0;
  const aiProcessingActivity = workerMetrics?.metrics && workerMetrics.metrics.length > 0
    ? workerMetrics.metrics[workerMetrics.metrics.length - 1]?.components?.analysisActivity || 0
    : 0;
  
  const analysisProgress = Math.max(baseAnalysisProgress, aiProcessingActivity);

  // Enhanced queue load (existing + database activity)
  const baseQueueLoad = analysisStats 
    ? Math.round((analysisStats.remainingRepositories / analysisStats.totalRepositories) * 100)
    : 0;
  
  const dbActivity = workerMetrics?.metrics && workerMetrics.metrics.length > 0
    ? workerMetrics.metrics[workerMetrics.metrics.length - 1]?.components?.dbActivity || 0
    : 0;

  const queueLoad = Math.max(baseQueueLoad, dbActivity);

  const systemHealth = status?.status === 'ok' ? 'SYSTEMS OPERATIONAL' : 'SYSTEM DEGRADED';
  const systemHealthColor = status?.status === 'ok' ? '#10b981' : '#f59e0b';

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(prev => (prev + 1) % 100);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="electric-layout">
      {/* Futuristic CSS Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .electric-layout {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          position: relative;
          overflow: hidden;
        }
        
        .electric-layout::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
          animation: electric-bg 8s ease-in-out infinite;
          pointer-events: none;
          z-index: 0;
        }
        
        @keyframes electric-bg {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        
        .electric-header {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          backdrop-filter: blur(10px);
          position: relative;
          z-index: 10;
        }
        
        .electric-header::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, #10b981, transparent);
          animation: header-scan 4s linear infinite;
        }
        
        @keyframes header-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .holographic-title {
          background: linear-gradient(45deg, #3b82f6, #10b981, #8b5cf6);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: holographic-shift 3s ease-in-out infinite;
          font-weight: 700;
        }
        
        @keyframes holographic-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .electric-github-icon {
          color: #3b82f6;
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
          animation: icon-pulse 2s ease-in-out infinite;
        }
        
        @keyframes icon-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .system-status {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 20px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          position: relative;
          overflow: hidden;
        }
        
        .system-status::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.2), transparent);
          animation: status-sweep 3s linear infinite;
        }
        
        @keyframes status-sweep {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .electric-sidebar {
          width: 256px;
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border-right: 1px solid rgba(59, 130, 246, 0.3);
          backdrop-filter: blur(10px);
          position: relative;
          z-index: 5;
        }
        
        .electric-sidebar::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 2px;
          height: 100%;
          background: linear-gradient(180deg, transparent, #3b82f6, transparent);
          animation: sidebar-scan 5s linear infinite;
        }
        
        @keyframes sidebar-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        
        .nav-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          margin: 4px 8px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
        }
        
        .nav-item:hover {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateX(4px);
        }
        
        .nav-item.active {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
          border-color: rgba(59, 130, 246, 0.5);
          color: #ffffff;
        }
        
        .nav-item.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          animation: nav-sweep 2s linear infinite;
        }
        
        @keyframes nav-sweep {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .nav-icon {
          margin-right: 12px;
          width: 20px;
          height: 20px;
          color: #e2e8f0 !important;
          filter: drop-shadow(0 0 6px rgba(226, 232, 240, 0.6));
        }
        
        .nav-item:hover .nav-icon {
          color: #ffffff !important;
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8));
        }
        
        .nav-item.active .nav-icon {
          color: #10b981 !important;
          filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.9));
          animation: icon-glow 2s ease-in-out infinite;
        }
        
        @keyframes icon-glow {
          0%, 100% { 
            filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.9));
            transform: scale(1);
          }
          50% { 
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 1));
            transform: scale(1.05);
          }
        }
        
        .electric-main {
          flex: 1;
          overflow-y: auto;
          background: transparent;
          position: relative;
          z-index: 1;
        }
        
        .nav-text {
          color: rgba(148, 163, 184, 0.9);
          transition: color 0.3s ease;
        }
        
        .nav-item:hover .nav-text {
          color: #ffffff;
        }
        
        .nav-item.active .nav-text {
          color: #ffffff;
          text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
        }
        
        /* System Activity Visualization */
        .system-activity-viz {
          margin: 24px 16px 16px 16px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 16px;
          position: relative;
          overflow: hidden;
        }
        
        .system-activity-viz::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
          animation: activity-bg 4s ease-in-out infinite;
        }
        
        @keyframes activity-bg {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        
        .activity-header {
          text-align: center;
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }
        
        .activity-title {
          background: linear-gradient(45deg, #3b82f6, #10b981);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: activity-title-glow 2s ease-in-out infinite;
          font-size: 0.75rem;
          font-weight: 600;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        @keyframes activity-title-glow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .activity-bars {
          display: flex;
          align-items: end;
          justify-content: space-between;
          height: 60px;
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }
        
        .activity-bar {
          width: 8px;
          background: linear-gradient(to top, #3b82f6, #10b981);
          border-radius: 2px;
          animation: activity-pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
        }
        
        .heartbeat-bar {
          width: 8px;
          border-radius: 2px;
          animation: heartbeat-pulse 2s ease-in-out infinite;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .heartbeat-bar[data-activity-type="user-interaction"] {
          background: linear-gradient(to top, #3b82f6, #10b981);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
        }
        
        .heartbeat-bar[data-activity-type="ai-processing"] {
          background: linear-gradient(to top, #8b5cf6, #3b82f6);
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
        }
        
        .heartbeat-bar[data-activity-type="data-operations"] {
          background: linear-gradient(to top, #10b981, #06b6d4);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
        }
        
        .heartbeat-bar[data-activity-type="system-maintenance"] {
          background: linear-gradient(to top, #f59e0b, #eab308);
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
        }
        
        @keyframes heartbeat-pulse {
          0%, 100% { 
            transform: scaleY(1) scaleX(1);
            filter: brightness(1);
          }
          25% { 
            transform: scaleY(1.1) scaleX(1.05);
            filter: brightness(1.2);
          }
          50% { 
            transform: scaleY(0.95) scaleX(0.98);
            filter: brightness(0.9);
          }
          75% { 
            transform: scaleY(1.05) scaleX(1.02);
            filter: brightness(1.1);
          }
        }
        
        @keyframes activity-pulse {
          0%, 100% { 
            transform: scaleY(0.8);
            box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
          }
          50% { 
            transform: scaleY(1.2);
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.8);
          }
        }
        
        .activity-metrics {
          margin-bottom: 16px;
          position: relative;
          z-index: 2;
        }
        
        .metric-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.75rem;
        }
        
        .metric-label {
          color: rgba(148, 163, 184, 0.8);
          width: 32px;
          font-weight: 500;
        }
        
        .metric-bar {
          flex: 1;
          height: 4px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 2px;
          margin: 0 8px;
          overflow: hidden;
        }
        
        .metric-fill {
          height: 100%;
          border-radius: 2px;
          animation: metric-flow 3s ease-in-out infinite;
        }
        
        .cpu-fill {
          background: linear-gradient(90deg, #3b82f6, #10b981);
          width: 78%;
        }
        
        .mem-fill {
          background: linear-gradient(90deg, #10b981, #3b82f6);
          width: 64%;
        }
        
        .net-fill {
          background: linear-gradient(90deg, #8b5cf6, #3b82f6);
          width: 92%;
        }
        
        @keyframes metric-flow {
          0%, 100% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.4); }
          50% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.8); }
        }
        
        .metric-value {
          color: #10b981;
          font-weight: 500;
          width: 32px;
          text-align: right;
          font-size: 0.65rem;
        }
        
        .data-stream-container {
          position: relative;
          height: 20px;
          margin-bottom: 16px;
          z-index: 2;
        }
        
        .stream-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
          transform: translateY(-50%);
        }
        
        .stream-particles {
          position: relative;
          height: 100%;
        }
        
        .stream-particle {
          position: absolute;
          top: 50%;
          left: 0;
          width: 4px;
          height: 4px;
          background: #10b981;
          border-radius: 50%;
          transform: translateY(-50%);
          animation: stream-flow 4s linear infinite;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
        }
        
        @keyframes stream-flow {
          0% { left: -4px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        
        .system-status-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          margin-right: 8px;
          animation: status-blink 2s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
        }
        
        @keyframes status-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        .status-text {
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.625rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        `
      }} />

      {/* Electric Header */}
      <header className="electric-header">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 relative z-10">
            <div className="flex items-center">
              <Github className="h-8 w-8 electric-github-icon" />
              <h1 className="ml-3 text-xl holographic-title">
                AI Repository Intelligence Dashboard
              </h1>
            </div>
            <div className="system-status">
              <Activity className="h-5 w-5 text-green-400 animate-pulse mr-2" />
              <span className="text-sm text-green-400 font-medium">
                System Active
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Electric Sidebar */}
        <nav className="electric-sidebar">
          <div className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn('nav-item', isActive && 'active')}
                >
                  <item.icon className="nav-icon" />
                  <span className="nav-text">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* System Activity Visualization */}
          <div className="system-activity-viz">
            <div className="activity-header">
              <h3 className="activity-title">⚡ SYSTEM ACTIVITY</h3>
            </div>
            
            {/* Live Activity Bars - System Heartbeat */}
            <div className="activity-bars">
              {workerMetrics?.metrics ? 
                workerMetrics.metrics.map((metric, i) => (
                  <div
                    key={i}
                    className="heartbeat-bar"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      height: `${Math.max(15, Math.min(95, metric.heartbeat))}%`,
                      animationDuration: `${2 + (metric.heartbeat / 100)}s`
                    }}
                    title={`${new Date(metric.timestamp).toLocaleTimeString()}: ${metric.heartbeat}% System Heartbeat
API: ${metric.components.apiActivity}% | AI: ${metric.components.analysisActivity}%
DB: ${metric.components.dbActivity}% | SYS: ${metric.components.systemActivity}%
Activity: ${metric.activityType.replace('-', ' ')}`}
                    data-activity-type={metric.activityType}
                  />
                )) :
                // Fallback to animated bars while loading
                [...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="activity-bar"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      height: `${20 + Math.random() * 60}%`
                    }}
                  />
                ))
              }
            </div>

            {/* System Metrics */}
            <div className="activity-metrics">
              <div 
                className="metric-row"
                title={`API Activity: ${apiUsage}%
Rate Limit Usage: ${rateLimitUsage}% (${status?.rateLimits?.github?.availableTokens || 0}/${status?.rateLimits?.github?.maxTokens || 0} tokens)
Real-time Activity: ${Math.round(realtimeApiActivity)}%
Hybrid calculation: 40% rate limits + 60% real-time activity`}
              >
                <span className="metric-label">API</span>
                <div className="metric-bar">
                  <div className="metric-fill cpu-fill" style={{ width: `${apiUsage}%` }} />
                </div>
                <span className="metric-value">{apiUsage}%</span>
              </div>
              <div 
                className="metric-row"
                title={`Analysis Progress: ${Math.round(analysisProgress)}%
Base Progress: ${Math.round(baseAnalysisProgress)}% (${analysisStats?.analyzedRepositories || 0}/${analysisStats?.totalRepositories || 0} repos)
AI Processing: ${Math.round(aiProcessingActivity)}%
Shows max of analysis progress or current AI activity`}
              >
                <span className="metric-label">ANA</span>
                <div className="metric-bar">
                  <div className="metric-fill mem-fill" style={{ width: `${analysisProgress}%` }} />
                </div>
                <span className="metric-value">{Math.round(analysisProgress)}%</span>
              </div>
              <div 
                className="metric-row"
                title={`Queue Load: ${queueLoad}%
Base Queue: ${baseQueueLoad}% (${analysisStats?.remainingRepositories || 0} repos remaining)
Database Activity: ${Math.round(dbActivity)}%
Shows max of queue load or current database activity`}
              >
                <span className="metric-label">QUE</span>
                <div className="metric-bar">
                  <div className="metric-fill net-fill" style={{ width: `${queueLoad}%` }} />
                </div>
                <span className="metric-value">{queueLoad}%</span>
              </div>
            </div>

            {/* Data Stream */}
            <div className="data-stream-container">
              <div className="stream-line" />
              <div className="stream-particles">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="stream-particle"
                    style={{ animationDelay: `${i * 0.8}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Status Indicator */}
            <div className="system-status-indicator">
              <div 
                className="status-dot" 
                style={{ 
                  background: systemHealthColor,
                  boxShadow: `0 0 8px ${systemHealthColor}66`
                }}
              />
              <span className="status-text">{systemHealth}</span>
            </div>
          </div>
        </nav>

        {/* Electric Main Content */}
        <main className="electric-main">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
