import React, { useState, useEffect } from 'react';
import { Activity, Database, Zap, Network, Shield } from 'lucide-react';

interface SystemPerformanceVizProps {
  status: any;
  trending: any;
  alerts: any;
}

export default function SystemPerformanceViz({ status, trending, alerts }: SystemPerformanceVizProps) {
  const [pulse, setPulse] = useState(0);
  const [activityLevel, setActivityLevel] = useState(0);
  
  // Create system heartbeat effect - FASTER AND MORE ALIVE!
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(prev => (prev + 1) % 100);
      // Simulate activity based on system health and data
      const baseActivity = status?.status === 'ok' ? 80 : 40; // Higher base activity
      const trendingBoost = trending?.total ? Math.min(trending.total / 8, 35) : 0; // More boost
      const alertsPenalty = alerts?.alerts?.length ? alerts.alerts.length * 3 : 0; // Less penalty
      setActivityLevel(Math.max(20, baseActivity + trendingBoost - alertsPenalty)); // Higher minimum
    }, 500); // FASTER heartbeat - 2x speed!
    
    return () => clearInterval(interval);
  }, [status, trending, alerts]);

  // Generate neural network grid
  const generateNeuralGrid = () => {
    const grid = [];
    for (let i = 0; i < 48; i++) {
      const isActive = Math.random() < (activityLevel / 100);
      const intensity = Math.random();
      const delay = Math.random() * 2;
      
      grid.push(
        <div
          key={i}
          className={`neural-node ${isActive ? 'active' : 'dormant'}`}
          style={{
            animationDelay: `${delay}s`,
            '--intensity': intensity,
          } as React.CSSProperties}
        />
      );
    }
    return grid;
  };

  const systemHealth = status?.status === 'ok' ? 'optimal' : 'warning';
  const apiCount = status?.rateLimits ? Object.keys(status.rateLimits).length : 0;
  const lastUpdate = status?.timestamp ? new Date(status.timestamp) : new Date();

  return (
    <div className="system-performance-viz">
      {/* Futuristic CSS Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .system-performance-viz {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 18px;
          position: relative;
          overflow: hidden;
        }
        
        .system-performance-viz::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
          animation: pulse-bg 3s ease-in-out infinite;
        }
        
        @keyframes pulse-bg {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        
        .neural-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 6px;
          margin: 16px 0;
          position: relative;
          z-index: 2;
        }
        
        .neural-node {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          position: relative;
          transition: all 0.3s ease;
        }
        
        .neural-node.active {
          background: linear-gradient(45deg, #10b981, #3b82f6);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.8);
          animation: neural-pulse 0.8s ease-in-out infinite;
        }
        
        .neural-node.dormant {
          background: linear-gradient(45deg, #374151, #4b5563);
          box-shadow: 0 0 4px rgba(75, 85, 99, 0.3);
          animation: dormant-flicker 3s ease-in-out infinite;
        }
        
        @keyframes neural-pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.8);
          }
          50% { 
            transform: scale(1.2);
            box-shadow: 0 0 25px rgba(16, 185, 129, 1);
          }
        }
        
        @keyframes dormant-flicker {
          0%, 90%, 100% { opacity: 0.6; }
          95% { opacity: 0.8; }
        }
        
        .metric-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid #475569;
          border-radius: 8px;
          padding: 16px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }
        
        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
          animation: scan-line 3s linear infinite;
        }
        
        @keyframes scan-line {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .holographic-text {
          background: linear-gradient(45deg, #3b82f6, #10b981, #8b5cf6);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: holographic 3s ease-in-out infinite;
          font-weight: 700;
        }
        
        @keyframes holographic {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 8px;
          position: relative;
        }
        
        .status-indicator.optimal {
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
          animation: status-pulse 2s ease-in-out infinite;
        }
        
        .status-indicator.warning {
          background: #f59e0b;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
          animation: status-pulse 1s ease-in-out infinite;
        }
        
        @keyframes status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .data-stream {
          position: absolute;
          width: 3px;
          height: 25px;
          background: linear-gradient(to bottom, transparent, #3b82f6, transparent);
          animation: data-flow 1.2s linear infinite;
        }
        
        @keyframes data-flow {
          0% { transform: translateY(-100px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100px); opacity: 0; }
        }
        
        .system-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 20px;
          position: relative;
          z-index: 2;
        }
        
        .activity-bar {
          height: 4px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 8px;
        }
        
        .activity-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #3b82f6);
          border-radius: 2px;
          transition: width 1s ease;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
        }
      `}} />

      {/* System Performance Header */}
      <div className="system-title holographic-text">
        🚀 NEURAL INTELLIGENCE CORE
      </div>

      {/* Neural Network Activity Grid */}
      <div className="neural-grid">
        {generateNeuralGrid()}
      </div>

      {/* Data Streams */}
      <div className="data-stream" style={{ left: '20%', animationDelay: '0s' }} />
      <div className="data-stream" style={{ left: '50%', animationDelay: '0.7s' }} />
      <div className="data-stream" style={{ left: '80%', animationDelay: '1.4s' }} />

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="metric-card">
          <div className="flex items-center mb-2">
            <div className={`status-indicator ${systemHealth}`} />
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">System Core</div>
          <div className="text-lg font-bold text-white mt-1">
            {status?.status === 'ok' ? 'OPTIMAL' : 'STANDBY'}
          </div>
          <div className="activity-bar">
            <div 
              className="activity-fill" 
              style={{ width: `${activityLevel}%` }}
            />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center mb-2">
            <div className="status-indicator optimal" />
            <Database className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Environment</div>
          <div className="text-lg font-bold text-white mt-1">
            {(status as any)?.environment?.toUpperCase() || 'PRODUCTION'}
          </div>
          <div className="activity-bar">
            <div className="activity-fill" style={{ width: '95%' }} />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center mb-2">
            <div className="status-indicator optimal" />
            <Network className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">API Channels</div>
          <div className="text-lg font-bold text-white mt-1">
            {apiCount} ACTIVE
          </div>
          <div className="activity-bar">
            <div className="activity-fill" style={{ width: `${Math.min(apiCount * 25, 100)}%` }} />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center mb-2">
            <div className="status-indicator optimal" />
            <Zap className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Last Sync</div>
          <div className="text-lg font-bold text-white mt-1">
            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="activity-bar">
            <div className="activity-fill" style={{ width: '88%' }} />
          </div>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="mt-4 p-3 bg-gradient-to-r from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-green-400 mr-2" />
            <span className="text-green-400 font-semibold">NEURAL CORE STATUS:</span>
            <span className="text-white ml-2 font-bold">ALL SYSTEMS OPERATIONAL</span>
          </div>
          <div className="text-xs text-gray-400">
            Activity Level: {activityLevel}% | Pulse: {pulse}
          </div>
        </div>
      </div>
    </div>
  );
}
