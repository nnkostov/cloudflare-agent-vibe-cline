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

  const stats = [
    {
      title: 'System Status',
      value: status?.status === 'ok' ? 'Healthy' : status?.status || 'Unknown',
      icon: Activity,
      color: status?.status === 'ok' ? 'text-green-600' : 'text-yellow-600',
    },
    {
      title: 'Monitored Repos',
      value: formatNumber(report?.total_monitored_repos || 0),
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
      value: formatNumber(alerts?.alerts.length || 0),
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

      {/* Tier Summary */}
      {report?.tier_summary && (
        <Card>
          <CardHeader>
            <CardTitle>Repository Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(report.tier_summary).map(([tier, data]: [string, any]) => (
                <div key={tier} className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {data.count}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Tier {tier} Repositories
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {tier === '1' && 'Hot Prospects'}
                    {tier === '2' && 'Rising Stars'}
                    {tier === '3' && 'Long Tail'}
                  </div>
                </div>
              ))}
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
      {status?.performance && (
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {status.performance.avgResponseTime || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {formatNumber(status.performance.totalRequests || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Cache Hit Rate</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {status.performance.cacheHitRate || 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Uptime</div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">
                  {status.performance.uptime || 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
