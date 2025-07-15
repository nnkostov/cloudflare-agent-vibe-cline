import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, Star, GitFork, ExternalLink } from 'lucide-react';
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
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {[1, 2, 3].map((tier) => {
            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier as 1 | 2 | 3)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedTier === tier
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                Tier {tier}
              </button>
            );
          })}
        </div>
      </div>

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
                      <Link
                        to={`/analysis/${repo.owner}/${repo.name}`}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                      >
                        View Analysis
                      </Link>
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
