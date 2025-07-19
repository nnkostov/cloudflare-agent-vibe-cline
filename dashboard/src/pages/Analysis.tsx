import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, TrendingUp, Users, Lightbulb, AlertTriangle, Loader2 } from 'lucide-react';
import { api, getScoreColor, getRecommendationBadge } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function Analysis() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ['analysis', owner, repo],
    queryFn: async () => {
      try {
        // First try to get existing analysis
        const result = await api.analyzeRepository(owner!, repo!, false);
        
        // Check if we got a valid analysis response
        if (result && result.analysis) {
          return result.analysis;
        } else if (result && result.message === 'Using cached analysis') {
          return result.analysis;
        } else {
          // No analysis found, trigger generation
          throw new Error('No analysis found');
        }
      } catch (error: any) {
        // Handle different error types
        if (error.message?.includes('not found') || 
            error.message?.includes('No analysis found') ||
            error.message?.includes('Repository') && error.message?.includes('not found')) {
          
          setIsGenerating(true);
          setGenerationMessage('No analysis found. Generating AI analysis...');
          
          try {
            // Force analysis generation
            const newAnalysis = await api.analyzeRepository(owner!, repo!, true);
            setIsGenerating(false);
            
            // Return the analysis from the response
            if (newAnalysis && newAnalysis.analysis) {
              return newAnalysis.analysis;
            } else {
              throw new Error('Failed to generate analysis');
            }
          } catch (genError: any) {
            setIsGenerating(false);
            console.error('Analysis generation failed:', genError);
            throw new Error(`Analysis generation failed: ${genError.message}`);
          }
        }
        throw error;
      }
    },
    enabled: !!owner && !!repo,
    retry: 1,
  });

  // Update generation message based on loading time
  useEffect(() => {
    if (isGenerating) {
      const messages = [
        'Analyzing repository structure...',
        'Evaluating code quality and architecture...',
        'Assessing market potential...',
        'Calculating investment scores...',
        'Finalizing analysis...'
      ];
      
      let messageIndex = 0;
      const interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setGenerationMessage(messages[messageIndex]);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  if (isLoading || isGenerating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/leaderboard"
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Leaderboard
          </Link>
        </div>
        
        {isGenerating ? (
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Generating AI Analysis
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                  {generationMessage}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 text-center">
                  This may take 15-30 seconds as we perform a comprehensive analysis of the repository.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link
            to="/leaderboard"
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Leaderboard
          </Link>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600 dark:text-red-400">
              Failed to load analysis for {owner}/{repo}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recommendation = getRecommendationBadge(analysis.recommendation);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/leaderboard"
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Leaderboard
          </Link>
        </div>
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          View on GitHub
          <ExternalLink className="h-4 w-4 ml-2" />
        </a>
      </div>

      {/* Repository Info */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {owner}/{repo}
        </h1>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${recommendation.color}`}>
            {recommendation.text}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Analyzed {formatDate(analysis.analyzed_at)}
          </span>
        </div>
      </div>

      {/* Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Investment Score
              </h3>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(analysis.investment_score)}`}>
              {analysis.investment_score}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Innovation Score
              </h3>
              <Lightbulb className="h-5 w-5 text-gray-400" />
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(analysis.innovation_score)}`}>
              {analysis.innovation_score}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Team Score
              </h3>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(analysis.team_score)}`}>
              {analysis.team_score}/100
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Market Score
              </h3>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(analysis.market_score)}`}>
              {analysis.market_score}/100
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.strengths.map((strength: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-500 mr-2">•</span>
                  <span className="text-gray-700 dark:text-gray-300">{strength}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.risks.map((risk: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span className="text-gray-700 dark:text-gray-300">{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Key Questions */}
      {analysis.key_questions && analysis.key_questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
              Key Questions for Due Diligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {analysis.key_questions.map((question: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="text-yellow-500 mr-2">?</span>
                  <span className="text-gray-700 dark:text-gray-300">{question}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Analysis (if available) */}
      {analysis.technical_moat && (
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Technical Moat</h4>
              <p className="text-gray-700 dark:text-gray-300">{analysis.technical_moat}</p>
            </div>
            {analysis.scalability_assessment && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                  Scalability Assessment
                </h4>
                <p className="text-gray-700 dark:text-gray-300">{analysis.scalability_assessment}</p>
              </div>
            )}
            {analysis.developer_adoption_potential && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                  Developer Adoption Potential
                </h4>
                <p className="text-gray-700 dark:text-gray-300">
                  {analysis.developer_adoption_potential}
                </p>
              </div>
            )}
            {analysis.growth_prediction && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                  Growth Prediction
                </h4>
                <p className="text-gray-700 dark:text-gray-300">{analysis.growth_prediction}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Model Info */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analysis performed using {analysis.model_used || 'Claude AI'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
