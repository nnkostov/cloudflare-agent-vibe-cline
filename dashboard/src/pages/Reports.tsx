import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
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
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {reportType === 'daily' ? 'Daily Investment Report' : 'Enhanced System Report'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Generated on {formatDate(report.date)}
                </p>
              </div>
            </CardContent>
          </Card>

              {/* Enhanced Report Content */}
              {reportType === 'enhanced' && enhancedReport && (
                <>
                  {/* Report Metadata */}
                  {enhancedReport.report_metadata && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right mb-2">
                      Last updated: {formatDate(enhancedReport.report_metadata.generated_at)}
                    </div>
                  )}

                  {/* Tier Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Repository Tier Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {Object.entries(enhancedReport.tier_summary).map(([tier, data]: [string, any]) => {
                          // Handle both old format (1,2,3) and new format (tier1,tier2,tier3)
                          const tierNumber = tier.replace('tier', '');
                          const tierLabel = tierNumber === '1' ? 'Hot Prospects' : 
                                           tierNumber === '2' ? 'Rising Stars' : 
                                           tierNumber === '3' ? 'Long Tail' : 'Unknown';
                          
                          return (
                            <div key={tier} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                {formatNumber(data.count)}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Tier {tierNumber} Repositories
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                {tierLabel}
                              </div>
                              {/* Show percentage if available */}
                              {data.percentage !== undefined && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                  {data.percentage}% of total
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* System Metrics */}
                  {enhancedReport.system_metrics && (
                    <Card>
                      <CardHeader>
                        <CardTitle>System Activity Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Repositories</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatNumber(enhancedReport.system_metrics.total_repositories || enhancedReport.total_monitored_repos)}
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Analyses</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatNumber(enhancedReport.system_metrics.total_analyses || 0)}
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400">Last 24h Activity</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatNumber(enhancedReport.system_metrics.analyses_last_24h || 0)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              analyses
                            </div>
                          </div>
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-sm text-gray-600 dark:text-gray-400">Repos Scanned</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {formatNumber(enhancedReport.system_metrics.repos_scanned_24h || 0)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              last 24h
                            </div>
                          </div>
                        </div>
                        {/* Data freshness indicator */}
                        {enhancedReport.system_metrics.data_freshness === 'live' && (
                          <div className="mt-4 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <span className="w-2 h-2 mr-1 bg-green-400 rounded-full animate-pulse"></span>
                              Live Data
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Investment Opportunities Section */}
                  {enhancedReport.investment_opportunities && enhancedReport.investment_opportunities.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">🏆</span>
                          Top Investment Opportunities
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {enhancedReport.investment_opportunities.map((opportunity, index) => (
                            <div 
                              key={opportunity.repository.id} 
                              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                      {index + 1}. {opportunity.repository.full_name}
                                    </span>
                                    <div className={`
                                      px-3 py-1 rounded-full text-sm font-medium
                                      ${opportunity.score_level === 'high' 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                        : opportunity.score_level === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                      }
                                    `}>
                                      Score: {opportunity.score}
                                    </div>
                                    {opportunity.has_analysis && (
                                      <span className="text-xs text-green-600 dark:text-green-400">
                                        ✓ Analyzed
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    <span>⭐ {formatNumber(opportunity.repository.stars)}</span>
                                    <span>📈 +{opportunity.repository.growth_rate.toFixed(1)}%/month</span>
                                    {opportunity.repository.language && (
                                      <span>💻 {opportunity.repository.language}</span>
                                    )}
                                  </div>
                                  
                                  {opportunity.repository.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                      {opportunity.repository.description}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="ml-4 text-right">
                                  <div className={`
                                    text-3xl font-bold
                                    ${opportunity.score >= 80 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : opportunity.score >= 60
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-gray-600 dark:text-gray-400'
                                    }
                                  `}>
                                    {opportunity.score}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    Investment Score
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            💡 <strong>Investment Score Calculation:</strong> Based on star count (30%), growth rate (40%), and recent activity (30%)
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Activity & Momentum Insights Section */}
                  {enhancedReport.activity_insights && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">📊</span>
                          Activity & Momentum Insights
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Most Active Repositories */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="text-xl">🔥</span>
                            Most Active Repositories
                          </h4>
                          <div className="space-y-2">
                            {enhancedReport.activity_insights.most_active_repos.map((repo, index) => (
                              <div key={repo.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900 dark:text-white">
                                    {index + 1}. {repo.full_name}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Updated {repo.hours_since_update}h ago • 
                                    👥 {repo.contributors} contributors • 
                                    Fork ratio: {repo.fork_ratio} • 
                                    📋 {repo.open_issues} issues
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Community Health */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="text-xl">👥</span>
                            Community Health
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {enhancedReport.activity_insights.community_metrics.large_teams}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                🌟 Large Teams
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                50+ contributors
                              </div>
                            </div>
                            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {enhancedReport.activity_insights.community_metrics.growing_teams}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                👥 Growing Teams
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                10-50 contributors
                              </div>
                            </div>
                            <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {enhancedReport.activity_insights.community_metrics.small_teams}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                🚀 Small Teams
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                &lt;10 contributors
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* AI Use Cases */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="text-xl">🎯</span>
                            AI Use Cases
                          </h4>
                          <div className="space-y-2">
                            {enhancedReport.activity_insights.use_case_distribution.map((useCase) => (
                              <div key={useCase.category} className="flex items-center gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {useCase.category}
                                    </span>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {useCase.percentage}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div 
                                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500"
                                      style={{ width: `${useCase.percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Momentum Status */}
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <span className="text-xl">📈</span>
                            Momentum Status
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="text-2xl mb-1">🚀</div>
                              <div className="text-xl font-bold text-green-700 dark:text-green-300">
                                {enhancedReport.activity_insights.momentum_indicators.accelerating}
                              </div>
                              <div className="text-xs text-green-600 dark:text-green-400">
                                Accelerating
                              </div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="text-2xl mb-1">📈</div>
                              <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {enhancedReport.activity_insights.momentum_indicators.growing}
                              </div>
                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                Growing
                              </div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="text-2xl mb-1">➡️</div>
                              <div className="text-xl font-bold text-gray-700 dark:text-gray-300">
                                {enhancedReport.activity_insights.momentum_indicators.steady}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                Steady
                              </div>
                            </div>
                            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                              <div className="text-2xl mb-1">📉</div>
                              <div className="text-xl font-bold text-orange-700 dark:text-orange-300">
                                {enhancedReport.activity_insights.momentum_indicators.cooling}
                              </div>
                              <div className="text-xs text-orange-600 dark:text-orange-400">
                                Cooling
                              </div>
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
                        <div className="text-sm text-gray-600 dark:text-gray-400">Analyses Performed</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(dailyReport.metrics.analyses_performed || 0)}
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Alerts Sent</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatNumber(dailyReport.metrics.alerts_sent || 0)}
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
                    <div className="space-y-6">
                      {dailyReport.investment_opportunities.slice(0, 5).map((opportunity: any, index: number) => (
                        <div key={opportunity.repository?.id || index} className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-green-500">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="font-semibold text-lg text-gray-900 dark:text-white">
                                  {opportunity.repository?.full_name || 'Unknown Repository'}
                                </div>
                                <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium rounded-full">
                                  {opportunity.analysis?.investment_score || 0}/100
                                </div>
                                <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium rounded-full capitalize">
                                  {opportunity.analysis?.recommendation || 'N/A'}
                                </div>
                              </div>
                              
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                ⭐ {formatNumber(opportunity.repository?.stars || 0)} stars • {opportunity.repository?.language || 'Unknown'}
                              </div>
                              
                              {opportunity.analysis?.strengths && opportunity.analysis.strengths.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Strengths:</div>
                                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    {opportunity.analysis.strengths.slice(0, 2).map((strength: string, idx: number) => (
                                      <li key={idx} className="flex items-start">
                                        <span className="text-green-500 mr-2">•</span>
                                        <span>{strength}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {opportunity.analysis?.summary && (
                                <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                                  {opportunity.analysis.summary.length > 200 
                                    ? `${opportunity.analysis.summary.substring(0, 200)}...` 
                                    : opportunity.analysis.summary}
                                </div>
                              )}
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
                  )?.slice(0, 10).map((repo: any, index: number) => {
                    // Handle different data structures between enhanced and daily reports
                    const repoData = reportType === 'enhanced' ? repo.repository : repo;
                    const repoId = repoData?.id || `${reportType}-${index}`;
                    const fullName = repoData?.full_name || repoData?.name || 'Unknown Repository';
                    const description = repoData?.description || 'No description';
                    const stars = repoData?.stars || 0;
                    const growthRate = repoData?.growth_rate || repo.growth_rate || 0;
                    
                    return (
                      <div key={repoId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {fullName}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {description}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            ⭐ {formatNumber(stars)}
                          </div>
                          {growthRate > 0 && (
                            <div className="text-xs text-green-600 dark:text-green-400">
                              +{growthRate.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
