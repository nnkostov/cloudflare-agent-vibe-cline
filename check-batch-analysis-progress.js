#!/usr/bin/env node

/**
 * Batch Analysis Progress Checker
 * 
 * This script checks the current state of batch analysis in production:
 * - Recent analysis activity
 * - Tier-by-tier progress
 * - Success/failure rates
 * - Recent errors
 * - API usage patterns
 */

const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  console.log('\n' + '='.repeat(80));
  log(message, 'bright');
  console.log('='.repeat(80));
}

function section(message) {
  console.log('\n' + '-'.repeat(80));
  log(message, 'cyan');
  console.log('-'.repeat(80));
}

async function fetchJSON(endpoint) {
  try {
    const url = `${WORKER_URL}${endpoint}`;
    log(`Fetching: ${url}`, 'blue');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    log(`Error fetching ${endpoint}: ${error.message}`, 'red');
    return null;
  }
}

async function checkAnalysisStats() {
  section('📊 Analysis Statistics');
  
  const stats = await fetchJSON('/api/analysis/stats');
  if (!stats) {
    log('❌ Failed to fetch analysis stats', 'red');
    return;
  }
  
  console.log('\n📈 Overall Progress:');
  log(`  Total Repositories: ${stats.totalRepositories}`, 'bright');
  log(`  Analyzed: ${stats.analyzedRepositories} (${stats.analysisProgress.toFixed(1)}%)`, 'green');
  log(`  Remaining: ${stats.remainingRepositories}`, 'yellow');
  
  console.log('\n🎯 Tier Breakdown:');
  for (const [tier, data] of Object.entries(stats.tierBreakdown)) {
    const tierNum = tier.replace('tier', '');
    const color = data.progress >= 80 ? 'green' : data.progress >= 50 ? 'yellow' : 'red';
    log(`  Tier ${tierNum}:`, 'bright');
    log(`    Total: ${data.total}`, 'blue');
    log(`    Analyzed: ${data.analyzed}`, 'green');
    log(`    Remaining: ${data.remaining}`, 'yellow');
    log(`    Progress: ${data.progress}%`, color);
  }
  
  console.log('\n⏱️  Batch Information:');
  log(`  Batch Size: ${stats.batchInfo.batchSize}`, 'blue');
  log(`  Batches Remaining: ${stats.batchInfo.estimatedBatchesRemaining}`, 'yellow');
  log(`  Estimated Time: ${stats.batchInfo.estimatedTimeRemaining}`, 'cyan');
  
  if (stats.recommendations && stats.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    stats.recommendations.forEach(rec => log(`  • ${rec}`, 'magenta'));
  }
  
  return stats;
}

async function checkRecentActivity() {
  section('🔍 Recent Activity Check');
  
  // Check trending repos endpoint which includes analysis info
  const trending = await fetchJSON('/api/repos/trending');
  if (!trending) {
    log('❌ Failed to fetch trending repos', 'red');
    return;
  }
  
  const totalRepos = trending.repositories.length;
  const analyzed = trending.repositories.filter(r => r.latest_analysis).length;
  const unanalyzed = totalRepos - analyzed;
  
  console.log('\n📦 Repository Sample (Top 10 Trending):');
  log(`  Total Visible: ${totalRepos}`, 'bright');
  log(`  With Analysis: ${analyzed} (${((analyzed/totalRepos)*100).toFixed(1)}%)`, 'green');
  log(`  Without Analysis: ${unanalyzed} (${((unanalyzed/totalRepos)*100).toFixed(1)}%)`, 'yellow');
  
  // Show some recent analyses
  const recentlyAnalyzed = trending.repositories
    .filter(r => r.latest_analysis && r.latest_analysis.metadata && r.latest_analysis.metadata.timestamp)
    .sort((a, b) => 
      new Date(b.latest_analysis.metadata.timestamp) - 
      new Date(a.latest_analysis.metadata.timestamp)
    )
    .slice(0, 5);
  
  if (recentlyAnalyzed.length > 0) {
    console.log('\n🔬 Recently Analyzed Repositories:');
    recentlyAnalyzed.forEach(repo => {
      const analysis = repo.latest_analysis;
      const timestamp = new Date(analysis.metadata.timestamp);
      const age = Math.round((Date.now() - timestamp.getTime()) / (1000 * 60)); // minutes
      log(`  ${repo.full_name}`, 'bright');
      log(`    Analyzed: ${age} minutes ago`, 'blue');
      log(`    Score: ${analysis.scores.investment}/100`, 
        analysis.scores.investment >= 80 ? 'green' : 
        analysis.scores.investment >= 60 ? 'yellow' : 'red');
      log(`    Model: ${analysis.metadata.model}`, 'cyan');
    });
  }
  
  // Check for repos that need analysis
  const needingAnalysis = trending.repositories
    .filter(r => !r.latest_analysis)
    .slice(0, 5);
  
  if (needingAnalysis.length > 0) {
    console.log('\n⏳ Repositories Awaiting Analysis:');
    needingAnalysis.forEach(repo => {
      log(`  ${repo.full_name} (Tier ${repo.tier}, ${repo.stars} stars)`, 'yellow');
    });
  }
}

async function checkSystemStatus() {
  section('⚙️  System Status');
  
  const status = await fetchJSON('/api/status');
  if (!status) {
    log('❌ Failed to fetch system status', 'red');
    return;
  }
  
  console.log('\n🌐 System Health:');
  log(`  Status: ${status.status}`, status.status === 'ok' ? 'green' : 'red');
  log(`  Environment: ${status.environment}`, 'blue');
  log(`  Timestamp: ${new Date(status.timestamp).toLocaleString()}`, 'cyan');
  
  console.log('\n📊 Rate Limits:');
  for (const [api, limits] of Object.entries(status.rateLimits)) {
    const usage = ((limits.maxTokens - limits.availableTokens) / limits.maxTokens) * 100;
    const color = usage > 80 ? 'red' : usage > 50 ? 'yellow' : 'green';
    log(`  ${api}:`, 'bright');
    log(`    Available: ${limits.availableTokens}/${limits.maxTokens}`, color);
    log(`    Usage: ${usage.toFixed(1)}%`, color);
    if (limits.resetAt) {
      const resetDate = new Date(limits.resetAt);
      const minutesUntilReset = Math.round((resetDate - Date.now()) / (1000 * 60));
      log(`    Resets in: ${minutesUntilReset} minutes`, 'cyan');
    }
  }
  
  if (status.tierDistribution) {
    console.log('\n🎯 Tier Distribution:');
    log(`  Tier 1: ${status.tierDistribution.tier1}`, 'red');
    log(`  Tier 2: ${status.tierDistribution.tier2}`, 'yellow');
    log(`  Tier 3: ${status.tierDistribution.tier3}`, 'green');
    if (status.tierDistribution.unassigned) {
      log(`  Unassigned: ${status.tierDistribution.unassigned}`, 'magenta');
    }
  }
}

async function checkAPIMetrics() {
  section('📡 API Usage Metrics');
  
  const metrics = await fetchJSON('/api/api-metrics?hours=24');
  if (!metrics) {
    log('❌ Failed to fetch API metrics', 'red');
    return;
  }
  
  console.log('\n📞 API Calls (Last 24 Hours):');
  
  if (metrics.apiCalls) {
    console.log('\n  GitHub API:');
    log(`    Today: ${metrics.apiCalls.github.today}`, 'bright');
    log(`    Remaining: ${metrics.apiCalls.github.remaining}/${metrics.apiCalls.github.limit}`, 'green');
    
    console.log('\n  Claude API:');
    log(`    Today: ${metrics.apiCalls.claude.today}`, 'bright');
    log(`    Analyses: ${metrics.apiCalls.claude.analyses}`, 'green');
    log(`    Tokens Used: ${metrics.apiCalls.claude.tokensUsed}`, 'cyan');
    if (metrics.apiCalls.claude.models) {
      log(`    Models Used:`, 'blue');
      if (metrics.apiCalls.claude.models.opus > 0) {
        log(`      Opus: ${metrics.apiCalls.claude.models.opus}`, 'magenta');
      }
      if (metrics.apiCalls.claude.models.sonnet > 0) {
        log(`      Sonnet: ${metrics.apiCalls.claude.models.sonnet}`, 'blue');
      }
      if (metrics.apiCalls.claude.models.haiku > 0) {
        log(`      Haiku: ${metrics.apiCalls.claude.models.haiku}`, 'cyan');
      }
    }
    
    console.log('\n  GitHub Search API:');
    log(`    Today: ${metrics.apiCalls.search.today}`, 'bright');
    log(`    Remaining: ${metrics.apiCalls.search.remaining}/${metrics.apiCalls.search.limit}`, 'green');
  }
  
  if (metrics.activity) {
    console.log('\n📊 Activity Summary:');
    log(`  Repositories Scanned: ${metrics.activity.repositoriesScanned}`, 'blue');
    log(`  Analyses Completed: ${metrics.activity.analysesCompleted}`, 'green');
    log(`  Last Activity: ${new Date(metrics.activity.lastActivity).toLocaleString()}`, 'cyan');
  }
}

async function generateSummary(stats) {
  header('📋 BATCH ANALYSIS SUMMARY');
  
  const now = new Date();
  log(`\n⏰ Report Generated: ${now.toLocaleString()}`, 'cyan');
  
  if (!stats) {
    log('\n❌ Unable to generate summary - stats not available', 'red');
    return;
  }
  
  console.log('\n🎯 Current Status:');
  
  // Overall progress assessment
  const overallProgress = stats.analysisProgress;
  if (overallProgress >= 90) {
    log(`  ✅ Excellent! ${overallProgress.toFixed(1)}% complete`, 'green');
  } else if (overallProgress >= 70) {
    log(`  ✓ Good progress: ${overallProgress.toFixed(1)}% complete`, 'yellow');
  } else if (overallProgress >= 50) {
    log(`  ⚠️  Moderate progress: ${overallProgress.toFixed(1)}% complete`, 'yellow');
  } else {
    log(`  ⚠️  Low progress: ${overallProgress.toFixed(1)}% complete`, 'red');
  }
  
  // Tier-specific status
  console.log('\n📊 Tier Status:');
  const tierBreakdown = stats.tierBreakdown;
  
  for (const [tier, data] of Object.entries(tierBreakdown)) {
    const tierNum = tier.replace('tier', '');
    const status = data.progress >= 80 ? '✅' : data.progress >= 50 ? '⚠️' : '❌';
    log(`  ${status} Tier ${tierNum}: ${data.analyzed}/${data.total} (${data.progress}%)`, 
      data.progress >= 80 ? 'green' : data.progress >= 50 ? 'yellow' : 'red');
  }
  
  // Time estimates
  console.log('\n⏱️  Estimates:');
  log(`  Remaining Work: ${stats.remainingRepositories} repositories`, 'yellow');
  log(`  Estimated Time: ${stats.batchInfo.estimatedTimeRemaining}`, 'cyan');
  log(`  Batches Remaining: ${stats.batchInfo.estimatedBatchesRemaining}`, 'blue');
  
  // Health check
  console.log('\n🏥 Health Check:');
  const tier1Progress = tierBreakdown.tier1.progress;
  const tier2Progress = tierBreakdown.tier2.progress;
  
  if (tier1Progress >= 80 && tier2Progress >= 60) {
    log('  ✅ System is healthy - high priority tiers well covered', 'green');
  } else if (tier1Progress >= 60) {
    log('  ⚠️  System is functional - consider running more batch analyses', 'yellow');
  } else {
    log('  ❌ Action needed - Tier 1 coverage is low', 'red');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

async function main() {
  header('🔍 BATCH ANALYSIS PROGRESS CHECK');
  log(`Checking: ${WORKER_URL}`, 'cyan');
  log(`Time: ${new Date().toLocaleString()}`, 'blue');
  
  try {
    // Check various endpoints
    const stats = await checkAnalysisStats();
    await checkRecentActivity();
    await checkSystemStatus();
    await checkAPIMetrics();
    
    // Generate summary
    await generateSummary(stats);
    
    log('✅ Progress check complete!', 'green');
  } catch (error) {
    log(`\n❌ Error during progress check: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
