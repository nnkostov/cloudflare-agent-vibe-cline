import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingUp, AlertTriangle, Database } from 'lucide-react';
import { api, formatNumber } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier Summary - Use status endpoint as primary source, enhanced report as fallback */}
      {(statusTierDistribution || report?.tier_summary) && (
        <Card>
          <CardHeader>
            <CardTitle>Repository Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {statusTierDistribution ? (
                // Use reliable status endpoint data
                <>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {statusTierDistribution.tier1}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Tier 1 Repositories
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      Premium Targets
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {statusTierDistribution.tier2}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Tier 2 Repositories
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      Emerging Opportunities
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {statusTierDistribution.tier3}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Tier 3 Repositories
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      Market Coverage
                    </div>
                  </div>
                </>
              ) : (
                // Fallback to enhanced report data
                Object.entries(report?.tier_summary || {}).map(([tier, data]: [string, any]) => (
                  <div key={tier} className="text-center">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {data.count}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Tier {tier} Repositories
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                      {tier === '1' && 'Premium Targets'}
                      {tier === '2' && 'Emerging Opportunities'}
                      {tier === '3' && 'Market Coverage'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent High Growth Repos */}
      {report?.high_growth_repos_with_metrics && report.high_growth_repos_with_metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>High Growth Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.high_growth_repos_with_metrics.slice(0, 5).map((repo: any) => (
                <div key={repo.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {repo.full_name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {repo.description || 'No description'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      ⭐ {formatNumber(repo.stars)}
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-400">
                      +{repo.growth_rate?.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Performance */}
      {(status?.performance || status) && (
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">System Status</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {status?.status === 'ok' ? 'Healthy' : status?.status || 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Environment</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {(status as any)?.environment || 'Production'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Rate Limits</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {status?.rateLimits ? Object.keys(status.rateLimits).length : 'N/A'} APIs
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Last Updated</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
