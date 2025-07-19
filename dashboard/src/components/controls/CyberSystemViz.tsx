import { useState, useEffect } from 'react';
import { Database, Zap, Network, Shield, Cpu, Activity, GitBranch, Brain } from 'lucide-react';

interface CyberSystemVizProps {
  status?: any;
  analysisStats?: any;
}

export default function CyberSystemViz({ status, analysisStats }: CyberSystemVizProps) {
  const [, setPulse] = useState(0);
  const [, setDataFlow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(prev => (prev + 1) % 100);
      setDataFlow(prev => (prev + 1) % 360);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const systemHealth = status?.status === 'ok' ? 100 : 60;
  const analysisProgress = analysisStats?.analysisProgress || 0;

  return (
    <div className="cyber-system-viz">
      <style dangerouslySetInnerHTML={{
        __html: `
        .cyber-system-viz {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 16px;
          padding: 24px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(15px);
          min-height: 350px;
        }
        
        .cyber-system-viz::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.05) 0%, transparent 70%);
          animation: cyber-bg 6s ease-in-out infinite;
        }
        
        @keyframes cyber-bg {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        
        .system-title {
          text-align: center;
          margin-bottom: 24px;
          position: relative;
          z-index: 10;
        }
        
        .cyber-title {
          background: linear-gradient(45deg, #3b82f6, #10b981, #8b5cf6);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: cyber-title-glow 3s ease-in-out infinite;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }
        
        @keyframes cyber-title-glow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .system-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          gap: 24px;
          height: 240px;
          position: relative;
          z-index: 5;
        }
        
        .system-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(30, 41, 59, 0.6);
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-radius: 16px;
          padding: 20px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        .system-node:hover {
          transform: scale(1.05);
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.3);
        }
        
        .system-node.active {
          border-color: rgba(16, 185, 129, 0.6);
          background: rgba(16, 185, 129, 0.1);
          animation: node-pulse 2s ease-in-out infinite;
        }
        
        @keyframes node-pulse {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 40px rgba(16, 185, 129, 0.6);
            transform: scale(1.02);
          }
        }
        
        .system-node.warning {
          border-color: rgba(245, 158, 11, 0.6);
          background: rgba(245, 158, 11, 0.1);
        }
        
        .node-icon {
          width: 32px;
          height: 32px;
          margin-bottom: 8px;
          filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.6));
        }
        
        .system-node.active .node-icon {
          filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.8));
          animation: icon-glow 2s ease-in-out infinite;
        }
        
        @keyframes icon-glow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(16, 185, 129, 0.8)); }
          50% { filter: drop-shadow(0 0 20px rgba(16, 185, 129, 1)); }
        }
        
        .node-label {
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.75rem;
          font-weight: 500;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .system-node.active .node-label {
          color: #10b981;
          text-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }
        
        .connection-line {
          position: absolute;
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
          height: 2px;
          animation: data-flow 3s linear infinite;
          z-index: 1;
        }
        
        @keyframes data-flow {
          0% { opacity: 0; transform: scaleX(0); }
          50% { opacity: 1; transform: scaleX(1); }
          100% { opacity: 0; transform: scaleX(0); }
        }
        
        .connection-vertical {
          width: 2px;
          background: linear-gradient(180deg, transparent, #10b981, transparent);
          animation: data-flow-vertical 2.5s linear infinite;
        }
        
        @keyframes data-flow-vertical {
          0% { opacity: 0; transform: scaleY(0); }
          50% { opacity: 1; transform: scaleY(1); }
          100% { opacity: 0; transform: scaleY(0); }
        }
        
        .system-metrics {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 8px;
          padding: 12px;
          min-width: 150px;
          z-index: 10;
        }
        
        .metric-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 0.75rem;
        }
        
        .metric-label {
          color: rgba(148, 163, 184, 0.8);
        }
        
        .metric-value {
          color: #10b981;
          font-weight: 600;
        }
        
        .energy-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
          border: 2px solid rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          animation: ring-rotate 20s linear infinite;
          z-index: 0;
        }
        
        .energy-ring::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          border: 2px solid transparent;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: ring-spin 4s linear infinite;
        }
        
        @keyframes ring-rotate {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        @keyframes ring-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .data-particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
          animation: particle-flow 4s linear infinite;
        }
        
        @keyframes particle-flow {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
        
        .matrix-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
            linear-gradient(180deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
          animation: matrix-scroll 10s linear infinite;
          z-index: 0;
        }
        
        @keyframes matrix-scroll {
          0% { transform: translate(0, 0); }
          100% { transform: translate(20px, 20px); }
        }
        `
      }} />

      {/* Matrix Background */}
      <div className="matrix-bg" />

      {/* Energy Ring */}
      <div className="energy-ring" />

      {/* System Title */}
      <div className="system-title">
        <h3 className="cyber-title">🔮 SYSTEM COMMAND CENTER</h3>
      </div>

      {/* System Metrics */}
      <div className="system-metrics">
        <div className="metric-item">
          <span className="metric-label">System Health</span>
          <span className="metric-value">{systemHealth}%</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Analysis Progress</span>
          <span className="metric-value">{analysisProgress.toFixed(1)}%</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Data Flow</span>
          <span className="metric-value">ACTIVE</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Neural Core</span>
          <span className="metric-value">ONLINE</span>
        </div>
      </div>

      {/* System Architecture Grid */}
      <div className="system-grid">
        {/* GitHub API Node */}
        <div className={`system-node ${status?.rateLimits?.github ? 'active' : 'warning'}`}>
          <GitBranch className="node-icon text-blue-400" />
          <div className="node-label">GitHub API</div>
        </div>

        {/* Neural Processing */}
        <div className="system-node active">
          <Brain className="node-icon text-purple-400" />
          <div className="node-label">Neural Core</div>
        </div>

        {/* Claude AI */}
        <div className={`system-node ${status?.rateLimits?.claude ? 'active' : 'warning'}`}>
          <Zap className="node-icon text-yellow-400" />
          <div className="node-label">Claude AI</div>
        </div>

        {/* Data Processing */}
        <div className="system-node active">
          <Cpu className="node-icon text-green-400" />
          <div className="node-label">Processing</div>
        </div>

        {/* Central Hub */}
        <div className="system-node active">
          <Activity className="node-icon text-cyan-400" />
          <div className="node-label">Control Hub</div>
        </div>

        {/* Network Layer */}
        <div className="system-node active">
          <Network className="node-icon text-indigo-400" />
          <div className="node-label">Network</div>
        </div>

        {/* Database */}
        <div className="system-node active">
          <Database className="node-icon text-emerald-400" />
          <div className="node-label">Database</div>
        </div>

        {/* Security */}
        <div className="system-node active">
          <Shield className="node-icon text-red-400" />
          <div className="node-label">Security</div>
        </div>

        {/* Analytics */}
        <div className="system-node active">
          <Activity className="node-icon text-orange-400" />
          <div className="node-label">Analytics</div>
        </div>
      </div>

      {/* Connection Lines */}
      <div className="connection-line" style={{
        top: '45%',
        left: '15%',
        width: '25%',
        animationDelay: '0s'
      }} />
      
      <div className="connection-line" style={{
        top: '45%',
        right: '15%',
        width: '25%',
        animationDelay: '1s'
      }} />

      <div className="connection-vertical" style={{
        left: '32%',
        top: '25%',
        height: '25%',
        animationDelay: '0.5s'
      }} />

      <div className="connection-vertical" style={{
        right: '32%',
        top: '25%',
        height: '25%',
        animationDelay: '1.5s'
      }} />

      {/* Data Particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="data-particle"
          style={{
            left: `${20 + i * 10}%`,
            top: `${30 + (i % 3) * 20}%`,
            animationDelay: `${i * 0.5}s`
          }}
        />
      ))}
    </div>
  );
}
