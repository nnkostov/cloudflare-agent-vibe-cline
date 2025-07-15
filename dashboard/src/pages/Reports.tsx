import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, AlertCircle } from 'lucide-react';
import { api, formatNumber } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';

export default function Reports() {
  const [reportType, setReportType] = useState<'daily' | 'enhanced'>('enhanced');

  const { data: dailyReport, isLoading: dailyLoading } = useQuery({
    queryKey: ['daily-report'],
    queryFn: api.getDailyReport,
    enabled: reportType === 'daily',
  });

  const { data: enhancedReport, isLoading: enhancedLoading } = useQuery({
    queryKey: ['enhanced-report'],
    queryFn: api.getEnhancedReport,
    enabled: reportType === 'enhanced',
  });

  const isLoading = dailyLoading || enhancedLoading;
  const report = reportType === 'daily' ? dailyReport : enhancedReport;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h2>
        
        {/* Report Type Selector */}
        <div className="flex space-x-2">
          <button
            onClick={() => setReportType('daily')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              reportType === 'daily'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Daily Report
          </button>
          <button
            onClick={() => setReportType('enhanced')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              reportType === 'enhanced'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Enhanced Report
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Report Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {reportType === 'daily' ? 'Daily Investment Report' : 'Enhanced System Report'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Generated on {formatDate(report.date)}
                  </p>
                </div>
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Report Content */}
          {reportType === 'enhanced' && enhancedReport && (
            <>
              {/* Tier Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Repository Tier Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {Object.entries(enhancedReport.tier_summary).map(([tier, data]: [string, any]) => (
                      <div key={tier} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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

              {/* System Metrics */}
              {enhancedReport.system_metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle>System Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Monitored</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(enhancedReport.total_monitored_repos)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Analyses Run</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(enhancedReport.system_metrics.analyses_run || 0)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Alerts Sent</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(enhancedReport.system_metrics.alerts_sent || 0)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">API Calls</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(enhancedReport.system_metrics.api_calls || 0)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Daily Report Content */}
          {reportType === 'daily' && dailyReport && (
            <>
              {/* Metrics Overview */}
              {dailyReport.metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Repos Scanned</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(dailyReport.metrics.repos_scanned || 0)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">New Analyses</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(dailyReport.metrics.new_analyses || 0)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Alerts Generated</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(dailyReport.metrics.alerts_generated || 0)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">High Growth</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(dailyReport.high_growth_repos?.length || 0)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Investment Opportunities */}
              {dailyReport.investment_opportunities && dailyReport.investment_opportunities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Investment Opportunities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dailyReport.investment_opportunities.slice(0, 5).map((repo: any) => (
                        <div key={repo.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {repo.full_name}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Score: {repo.investment_score}/100 • {repo.recommendation}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              ⭐ {formatNumber(repo.stars)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* High Growth Repos (both reports) */}
          {((reportType === 'enhanced' && enhancedReport?.high_growth_repos_with_metrics) ||
            (reportType === 'daily' && dailyReport?.high_growth_repos)) && (
            <Card>
              <CardHeader>
                <CardTitle>High Growth Repositories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(reportType === 'enhanced' 
                    ? enhancedReport?.high_growth_repos_with_metrics 
                    : dailyReport?.high_growth_repos
                  )?.slice(0, 10).map((repo: any) => (
                    <div key={repo.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
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
                        {repo.growth_rate && (
                          <div className="text-xs text-green-600 dark:text-green-400">
                            +{repo.growth_rate.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Alerts */}
          {report.recent_alerts && report.recent_alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.recent_alerts.slice(0, 5).map((alert: any) => (
                    <div key={alert.id} className="flex items-start space-x-3">
                      <AlertCircle className={`h-5 w-5 mt-0.5 ${
                        alert.level === 'urgent' ? 'text-red-500' :
                        alert.level === 'high' ? 'text-orange-500' :
                        'text-yellow-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">{alert.message}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(alert.sent_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No report data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
