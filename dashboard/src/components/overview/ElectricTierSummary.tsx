import { useState, useEffect } from 'react';

interface ElectricTierSummaryProps {
  statusTierDistribution?: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  reportTierSummary?: any;
}

export default function ElectricTierSummary({ statusTierDistribution, reportTierSummary }: ElectricTierSummaryProps) {
  const [, setEnergyLevel] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setEnergyLevel(prev => (prev + 1) % 100);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const tierData = statusTierDistribution ? [
    { tier: 1, count: statusTierDistribution.tier1, label: 'Premium Targets', color: 'gold' },
    { tier: 2, count: statusTierDistribution.tier2, label: 'Emerging Opportunities', color: 'blue' },
    { tier: 3, count: statusTierDistribution.tier3, label: 'Market Coverage', color: 'green' }
  ] : Object.entries(reportTierSummary || {}).map(([tier, data]: [string, any]) => ({
    tier: parseInt(tier),
    count: data.count,
    label: tier === '1' ? 'Premium Targets' : tier === '2' ? 'Emerging Opportunities' : 'Market Coverage',
    color: tier === '1' ? 'gold' : tier === '2' ? 'blue' : 'green'
  }));

  return (
    <div className="electric-tier-summary">
      <style dangerouslySetInnerHTML={{
        __html: `
        .electric-tier-summary {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 16px;
          padding: 20px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(15px);
          margin: 16px 0;
        }
        
        .electric-tier-summary::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 70% 30%, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
          animation: tier-energy 4s ease-in-out infinite;
        }
        
        @keyframes tier-energy {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        
        .tier-header {
          position: relative;
          z-index: 2;
          text-align: center;
          margin-bottom: 20px;
        }
        
        .tier-title {
          background: linear-gradient(45deg, #3b82f6, #10b981, #8b5cf6);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: tier-title-glow 3s ease-in-out infinite;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }
        
        @keyframes tier-title-glow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .tier-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          position: relative;
          z-index: 2;
        }
        
        .tier-card {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(75, 85, 99, 0.3);
          border-radius: 12px;
          padding: 18px;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        
        .tier-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }
        
        .tier-card.gold {
          border-color: rgba(251, 191, 36, 0.4);
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(30, 41, 59, 0.8) 100%);
        }
        
        .tier-card.gold::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #fbbf24, transparent);
          animation: gold-scan 2.5s linear infinite;
        }
        
        .tier-card.blue {
          border-color: rgba(59, 130, 246, 0.4);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(30, 41, 59, 0.8) 100%);
        }
        
        .tier-card.blue::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
          animation: blue-scan 3s linear infinite;
        }
        
        .tier-card.green {
          border-color: rgba(16, 185, 129, 0.4);
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(30, 41, 59, 0.8) 100%);
        }
        
        .tier-card.green::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #10b981, transparent);
          animation: green-scan 3.5s linear infinite;
        }
        
        @keyframes gold-scan {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        @keyframes blue-scan {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        @keyframes green-scan {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .tier-count {
          font-size: 3rem;
          font-weight: 800;
          margin: 16px 0;
          position: relative;
          z-index: 2;
        }
        
        .tier-count.gold {
          color: #fbbf24;
          text-shadow: 0 0 20px rgba(251, 191, 36, 0.5);
          animation: gold-pulse 2s ease-in-out infinite;
        }
        
        .tier-count.blue {
          color: #3b82f6;
          text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
          animation: blue-pulse 2.2s ease-in-out infinite;
        }
        
        .tier-count.green {
          color: #10b981;
          text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
          animation: green-pulse 2.4s ease-in-out infinite;
        }
        
        @keyframes gold-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(251, 191, 36, 0.5); }
          50% { text-shadow: 0 0 30px rgba(251, 191, 36, 0.8); }
        }
        
        @keyframes blue-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(59, 130, 246, 0.5); }
          50% { text-shadow: 0 0 30px rgba(59, 130, 246, 0.8); }
        }
        
        @keyframes green-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(16, 185, 129, 0.5); }
          50% { text-shadow: 0 0 30px rgba(16, 185, 129, 0.8); }
        }
        
        .tier-label {
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.875rem;
          font-weight: 500;
          margin: 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .tier-description {
          color: rgba(148, 163, 184, 0.7);
          font-size: 0.75rem;
          font-weight: 400;
          margin-top: 12px;
          position: relative;
          z-index: 2;
        }
        
        .energy-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        
        .energy-fill {
          height: 100%;
          animation: energy-flow 2s linear infinite;
        }
        
        .energy-fill.gold {
          background: linear-gradient(90deg, transparent, #fbbf24, transparent);
        }
        
        .energy-fill.blue {
          background: linear-gradient(90deg, transparent, #3b82f6, transparent);
        }
        
        .energy-fill.green {
          background: linear-gradient(90deg, transparent, #10b981, transparent);
        }
        
        @keyframes energy-flow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        `
      }} />

      <div className="tier-header">
        <h2 className="tier-title">⚡ REPOSITORY INTELLIGENCE TIERS</h2>
      </div>

      <div className="tier-grid">
        {tierData.map((tier) => (
          <div key={tier.tier} className={`tier-card ${tier.color}`}>
            <div className={`tier-count ${tier.color}`}>
              {tier.count}
            </div>
            <div className="tier-label">
              Tier {tier.tier} Repositories
            </div>
            <div className="tier-description">
              {tier.label}
            </div>
            <div className="energy-bar">
              <div className={`energy-fill ${tier.color}`}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
