import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, TrendingUp, Users, Lightbulb, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { api, getScoreColor, getRecommendationBadge } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface AnalysisData {
  repo_id: string;
  investment_score: number;
  innovation_score: number;
  team_score: number;
  market_score: number;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'pass';
  summary: string;
  strengths: string[];
  risks: string[];
  key_questions: string[];
  model_used: string;
  analyzed_at: string;
  technical_moat?: string;
  scalability_assessment?: string;
  developer_adoption_potential?: string;
  growth_prediction?: string;
}

export default function Analysis() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const shouldGenerateImmediately = searchParams.get('generate') === 'true';
  const [isGenerating, setIsGenerating] = useState(shouldGenerateImmediately);
  const [generationMessage, setGenerationMessage] = useState(shouldGenerateImmediately ? 'Initiating AI analysis...' : '');
  const [pollingInterval, setPollingInterval] = useState<number | false>(false);
  const [shouldGenerate, setShouldGenerate] = useState(false);

  // Query to check if analysis exists
  const { data: analysisResponse, isLoading, error } = useQuery<{analysis: AnalysisData, repository: any} | null>({
    queryKey: ['analysis', owner, repo],
    queryFn: async () => {
      // Skip the initial check if we should generate immediately
      if (shouldGenerateImmediately) {
        console.log('[Analysis] Skipping initial check - will generate immediately');
        return null;
      }
      
      console.log('[Analysis] Starting query for:', owner, repo);
      try {
        // Only fetch existing analysis, don't trigger generation here
        const result = await api.analyzeRepository(owner!, repo!, false);
        console.log('[Analysis] Query result:', result);
        console.log('[Analysis] Result type:', typeof result);
        console.log('[Analysis] Result keys:', result ? Object.keys(result) : 'null');
        
        // The API returns { message: string, analysis: AnalysisData, repository: RepositoryData } structure
        if (result && result.analysis) {
          console.log('[Analysis] Found analysis in result.analysis');
          console.log('[Analysis] Analysis data:', result.analysis);
          console.log('[Analysis] Repository data:', result.repository);
          console.log('[Analysis] analyzed_at field:', result.analysis.analyzed_at);
          return { analysis: result.analysis, repository: result.repository };
        }
        
        // If we get an error response, return null to trigger generation
        if (result && result.error) {
          console.log('[Analysis] Got error response:', result.error);
          return null;
        }
        
        // Return null if no analysis exists yet
        console.log('[Analysis] No analysis found, returning null');
        return null;
      } catch (error: any) {
        console.error('[Analysis] Query error:', error);
        // If it's a 404, that means no analysis exists
        if (error.message && error.message.includes('404')) {
          console.log('[Analysis] 404 error - no analysis exists');
          return null;
        }
        // For other errors, still return null to trigger generation
        return null;
      }
    },
    enabled: !!owner && !!repo && !shouldGenerateImmediately,
    retry: false,
    refetchInterval: pollingInterval,
  });

  // Extract analysis and repository data
  const analysis = analysisResponse?.analysis || null;
  const repository = analysisResponse?.repository || null;

  // Mutation to trigger analysis generation
  const generateAnalysisMutation = useMutation({
    mutationFn: async () => {
      console.log('[Analysis] Starting analysis generation...');
      setIsGenerating(true);
      setGenerationMessage('Initiating AI analysis...');
      
      try {
        // Trigger analysis generation
        const result = await api.analyzeRepository(owner!, repo!, true);
        console.log('[Analysis] Generation API response:', result);
        
        // Handle different response formats
        if (result) {
          // Check if we got the analysis directly
          if (result.analysis) {
            console.log('[Analysis] Got immediate analysis result');
            return { analysis: result.analysis, repository: result.repository };
          }
          
          // Check if it's wrapped in a response object
          if (result.message && result.analysis) {
            console.log('[Analysis] Got analysis in response wrapper');
            return { analysis: result.analysis, repository: result.repository };
          }
          
          // If we get a message saying analysis is being generated, start polling
          if (result.message && (result.message.includes('completed') || result.message.includes('Analysis'))) {
            console.log('[Analysis] Analysis generation started, will poll for results');
            return null;
          }
        }
        
        // Otherwise, start polling
        console.log('[Analysis] No immediate result, will start polling');
        return null;
      } catch (error) {
        console.error('[Analysis] Error during generation:', error);
        // Don't throw - return null to trigger polling
        return null;
      }
    },
    onSuccess: (data) => {
      console.log('[Analysis] Generation mutation success:', data);
      if (data) {
        // Analysis completed immediately
        setIsGenerating(false);
        setPollingInterval(false);
        queryClient.setQueryData(['analysis', owner, repo], data);
      } else {
        // Start polling for results
        console.log('[Analysis] Starting polling...');
        setPollingInterval(3000); // Poll every 3 seconds
      }
    },
    onError: (error: any) => {
      console.error('[Analysis] Generation mutation error:', error);
      setIsGenerating(false);
      setPollingInterval(false);
      // Don't let the error cause a blank screen - keep showing the loading state
      // but with an error message
    },
  });

  // Stop polling when analysis is found and is complete
  useEffect(() => {
    if (analysis && isGenerating) {
      // Check if the analysis is complete (has all required fields)
      // Just check for a valid date - the model name might vary
      const hasValidDate = analysis.analyzed_at && 
                          analysis.analyzed_at !== 'Invalid Date' &&
                          !analysis.analyzed_at.includes('Invalid');
      
      if (hasValidDate) {
        console.log('[Analysis] Analysis complete with valid date, stopping generation state');
        setIsGenerating(false);
        setPollingInterval(false);
      } else {
        console.log('[Analysis] Analysis found but date invalid, continuing to poll...', {
          analyzed_at: analysis.analyzed_at,
          model_used: analysis.model_used
        });
      }
    }
  }, [analysis, isGenerating]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      setPollingInterval(false);
    };
  }, []);

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

  // Trigger generation immediately if query parameter is present
  useEffect(() => {
    if (shouldGenerateImmediately && owner && repo && !generateAnalysisMutation.isPending) {
      console.log('[Analysis] Triggering immediate generation due to query parameter');
      generateAnalysisMutation.mutate();
    }
  }, [shouldGenerateImmediately, owner, repo]); // Only run once on mount

  // Trigger analysis generation if no analysis exists after initial load
  useEffect(() => {
    console.log('[Analysis] Auto-trigger check:', {
      isLoading,
      hasAnalysis: !!analysis,
      hasError: !!error,
      isGenerating,
      owner,
      repo,
      shouldGenerate,
      shouldGenerateImmediately,
      isPending: generateAnalysisMutation.isPending
    });
    
    // Skip if we're already generating from the query parameter
    if (shouldGenerateImmediately) {
      return;
    }
    
    if (!isLoading && !analysis && !error && !isGenerating && owner && repo && !shouldGenerate) {
      console.log('[Analysis] Conditions met - triggering generation...');
      setShouldGenerate(true);
      // Small delay to ensure state is settled
      setTimeout(() => {
        console.log('[Analysis] Calling generateAnalysisMutation.mutate()');
        generateAnalysisMutation.mutate();
      }, 100);
    }
  }, [isLoading, analysis, error, isGenerating, owner, repo, shouldGenerate, shouldGenerateImmediately]); // Removed mutation from deps

  // Show loading state if we're loading, generating, or about to generate
  if (isLoading || isGenerating || (shouldGenerateImmediately && !analysis)) {
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
        
        {(isGenerating || shouldGenerateImmediately) ? (
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

      {/* Repository Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2 text-gray-500" />
            Repository Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {repository?.description || 'No description available'}
          </p>
        </CardContent>
      </Card>

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
