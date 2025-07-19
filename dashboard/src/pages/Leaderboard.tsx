import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, Star, GitFork, ExternalLink, FileText, Sparkles, Flame, Award, Rocket, BarChart3 } from 'lucide-react';
import { api, formatNumber, getRecommendationBadge } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { getTierBadge, getLanguageColor, truncateText } from '@/lib/utils';

export default function Leaderboard() {
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3 | null>(null);

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: api.getTrendingRepos,
    enabled: !selectedTier,
  });

  const { data: tierData, isLoading: tierLoading } = useQuery({
    queryKey: ['tier', selectedTier],
    queryFn: () => api.getReposByTier(selectedTier!),
    enabled: !!selectedTier,
  });

  const isLoading = trendingLoading || tierLoading;
  const repos = selectedTier ? tierData?.repos : trending?.repositories;

  // Get explanation content based on selected view
  const getExplanationCard = () => {
    if (!selectedTier) {
      // Trending view
      const count = trending?.total || repos?.length || 0;
      return (
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Flame className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
                  🔥 Trending Repositories ({count} shown)
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">
                  Showing the most promising AI/ML repositories based on recent momentum:
                  <br />• Recent development activity and community engagement
                  <br />• Star growth velocity and developer adoption signals
                  <br />• Innovation potential and market impact indicators
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    } else if (selectedTier === 1) {
      const count = tierData?.count || repos?.length || 0;
      return (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Award className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  ⭐ Tier 1 - Premium Investment Targets ({count} repositories)
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                  High-priority repositories with exceptional potential:
                  <br />• 10,000+ stars or rapid growth trajectory
                  <br />• Active development and strong community engagement
                  <br />• Significant market impact and proven innovation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    } else if (selectedTier === 2) {
      const count = tierData?.count || repos?.length || 0;
      return (
        <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Rocket className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  🚀 Tier 2 - Emerging Opportunities ({count} repositories)
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  Promising repositories showing strong growth signals:
                  <br />• 1,000+ stars with consistent development activity
                  <br />• Growing community adoption and engagement
                  <br />• Strong potential for future investment consideration
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    } else if (selectedTier === 3) {
      const count = tierData?.count || repos?.length || 0;
      return (
        <Card className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 border-gray-200 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <BarChart3 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  📊 Tier 3 - Comprehensive Coverage ({count} repositories)
                </h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  Complete AI/ML ecosystem monitoring and trend analysis:
                  <br />• Broad market coverage including early-stage projects
                  <br />• Emerging patterns and niche solution tracking
                  <br />• Foundation for comprehensive market intelligence
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Repository Leaderboard</h2>
        
        {/* Tier Filter */}
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedTier(null)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              !selectedTier
                ? 'bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Trending
          </button>
          {[1, 2, 3].map((tier) => {
            const colors = {
              1: selectedTier === tier 
                ? 'bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              2: selectedTier === tier 
                ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              3: selectedTier === tier 
                ? 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            };
            
            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier as 1 | 2 | 3)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${colors[tier as keyof typeof colors]}`}
              >
                Tier {tier}
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation Card */}
      {getExplanationCard()}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4"></div>
                  <div className="flex space-x-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {repos?.map((repo: any, index: number) => {
            const analysis = repo.latest_analysis;
            const recommendation = analysis ? getRecommendationBadge(analysis.recommendation) : null;
            const tierBadge = repo.tier ? getTierBadge(repo.tier) : null;

            return (
              <Card key={repo.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          #{index + 1} {repo.full_name}
                        </h3>
                        {tierBadge && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${tierBadge.color}`}>
                            {tierBadge.text}
                          </span>
                        )}
                        {recommendation && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${recommendation.color}`}>
                            {recommendation.text}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {truncateText(repo.description || 'No description available', 150)}
                      </p>

                      <div className="flex items-center space-x-6 text-sm">
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {formatNumber(repo.stars)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <GitFork className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {formatNumber(repo.forks)}
                          </span>
                        </div>
                        {repo.language && (
                          <div className="flex items-center space-x-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getLanguageColor(repo.language) }}
                            />
                            <span className="text-gray-700 dark:text-gray-300">{repo.language}</span>
                          </div>
                        )}
                        {analysis && (
                          <div className="flex items-center space-x-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="text-gray-700 dark:text-gray-300">
                              Score: {analysis.investment_score}/100
                            </span>
                          </div>
                        )}
                      </div>

                      {repo.topics && repo.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {repo.topics.slice(0, 5).map((topic: string) => (
                            <span
                              key={topic}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      {(() => {
                        const [owner, name] = repo.full_name.split('/');
                        const hasAnalysis = !!analysis;
                        
                        return (
                          <Link
                            to={`/analysis/${owner}/${name}`}
                            className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              hasAnalysis
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                          >
                            {hasAnalysis ? (
                              <>
                                <FileText className="h-4 w-4 mr-1" />
                                View Analysis
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                Generate Analysis
                              </>
                            )}
                          </Link>
                        );
                      })()}
                      <a
                        href={`https://github.com/${repo.full_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
