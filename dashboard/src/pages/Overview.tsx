import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp, AlertTriangle, Database } from 'lucide-react';
import { api, formatNumber } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import SystemPerformanceViz from '@/components/overview/SystemPerformanceViz';
import ElectricStatsGrid from '@/components/overview/ElectricStatsGrid';
import ElectricTierSummary from '@/components/overview/ElectricTierSummary';

export default function Overview() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: api.getStatus,
  });

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: api.getTrendingRepos,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.getAlerts,
  });

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['enhanced-report'],
    queryFn: api.getEnhancedReport,
  });

  // Debug logging
  console.log('[Overview] Data received:', JSON.stringify({
    trending,
    alerts,
    report,
    trendingTotal: trending?.total,
    alertsLength: alerts?.alerts?.length,
  }, null, 2));

  const isLoading = statusLoading || trendingLoading || alertsLoading || reportLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate total repos from reliable status endpoint tier distribution
  const statusTierDistribution = (status as any)?.tierDistribution;
  const totalRepos = statusTierDistribution ? 
    (statusTierDistribution.tier1 + statusTierDistribution.tier2 + statusTierDistribution.tier3) : 
    (report?.total_monitored_repos || 0);

  const stats = [
    {
      title: 'System Status',
      value: status?.status === 'ok' ? 'Healthy' : status?.status || 'Unknown',
      icon: Activity,
      color: status?.status === 'ok' ? 'text-green-600' : 'text-yellow-600',
    },
    {
      title: 'Monitored Repos',
      value: formatNumber(totalRepos),
      icon: Database,
      color: 'text-blue-600',
    },
    {
      title: 'Trending Repos',
      value: formatNumber(trending?.total || 0),
      icon: TrendingUp,
      color: 'text-purple-600',
    },
    {
      title: 'Active Alerts',
      value: formatNumber(alerts?.alerts?.length || 0),
      icon: AlertTriangle,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Overview</h2>

      {/* Electric Stats Grid */}
      <ElectricStatsGrid stats={stats} />

      {/* Electric Tier Summary */}
      {(statusTierDistribution || report?.tier_summary) && (
        <ElectricTierSummary 
          statusTierDistribution={statusTierDistribution}
          reportTierSummary={report?.tier_summary}
        />
      )}

      {/* Futuristic System Performance Visualization */}
      <SystemPerformanceViz 
        status={status}
        trending={trending}
        alerts={alerts}
      />
    </div>
  );
}
