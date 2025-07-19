import { useState, useEffect } from 'react';

interface ElectricStatsGridProps {
  stats: Array<{
    title: string;
    value: string;
    icon: any;
    color: string;
  }>;
}

export default function ElectricStatsGrid({ stats }: ElectricStatsGridProps) {
  const [, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(prev => (prev + 1) % 100);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="electric-stats-grid">
      <style dangerouslySetInnerHTML={{
        __html: `
        .electric-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin: 16px 0;
        }
        
        .electric-stat-card {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
          padding: 18px;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }
        
        .electric-stat-card:hover {
          border-color: rgba(59, 130, 246, 0.6);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.2);
        }
        
        .electric-stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, #10b981, transparent);
          animation: electric-scan 3s linear infinite;
        }
        
        @keyframes electric-scan {
          0% { left: -100%; }
          100% { left: 100%; }
        }
        
        .electric-stat-card::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          background: radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%);
          animation: electric-pulse 2s ease-in-out infinite;
        }
        
        @keyframes electric-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        
        .stat-content {
          position: relative;
          z-index: 2;
          display: flex;
          items-center;
          justify-content: space-between;
        }
        
        .stat-info h3 {
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.875rem;
          font-weight: 500;
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .stat-value {
          color: white;
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
          animation: value-glow 3s ease-in-out infinite;
        }
        
        @keyframes value-glow {
          0%, 100% { text-shadow: 0 0 10px rgba(255, 255, 255, 0.3); }
          50% { text-shadow: 0 0 20px rgba(255, 255, 255, 0.5); }
        }
        
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          animation: icon-pulse 2s ease-in-out infinite;
        }
        
        @keyframes icon-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .stat-icon.green {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.4));
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
        }
        
        .stat-icon.blue {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.4));
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
        
        .stat-icon.purple {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.4));
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
        }
        
        .stat-icon.orange {
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.4));
          box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
        }
        
        .electric-border {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(45deg, #3b82f6, #10b981, #8b5cf6, #f97316);
          background-size: 300% 300%;
          animation: electric-border 4s ease-in-out infinite;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .electric-stat-card:hover .electric-border {
          opacity: 1;
        }
        
        @keyframes electric-border {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .electric-border > div {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%);
          border-radius: 15px;
        }
        `
      }} />

      {stats.map((stat) => {
        const iconColorClass = stat.color.includes('green') ? 'green' : 
                              stat.color.includes('blue') ? 'blue' :
                              stat.color.includes('purple') ? 'purple' : 'orange';
        
        return (
          <div key={stat.title} className="electric-stat-card">
            <div className="electric-border">
              <div></div>
            </div>
            <div className="stat-content">
              <div className="stat-info">
                <h3>{stat.title}</h3>
                <div className="stat-value">{stat.value}</div>
              </div>
              <div className={`stat-icon ${iconColorClass}`}>
                <stat.icon size={24} className={stat.color} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
