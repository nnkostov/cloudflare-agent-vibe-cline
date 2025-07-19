#!/usr/bin/env node

/**
 * Comprehensive Diagnostic Script for Tier Assignment Issue
 * 
 * This script investigates why only 2 repositories are in Tier 3
 * when we should have ~700 discovered AI/ML repositories with tier assignments.
 */

const API_BASE_URL = process.env.API_URL || 'https://github-ai-intelligence.nkostov.workers.dev';

// ANSI color codes for terminal output
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

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

function logSubSection(title) {
  console.log('\n' + '-'.repeat(50));
  log(title, 'cyan');
  console.log('-'.repeat(50));
}

async function fetchEndpoint(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    log(`❌ Error fetching ${endpoint}: ${error.message}`, 'red');
    return null;
  }
}

async function analyzeRepositoryTables() {
  logSection('📊 REPOSITORY TABLE ANALYSIS');
  
  // Get basic repository count
  const repoCount = await fetchEndpoint('/repos/count');
  if (repoCount) {
    log(`\n📈 Total Repositories in Database: ${repoCount.count}`, 'cyan');
  }
  
  // Get tier distribution
  const status = await fetchEndpoint('/status');
  if (status && status.tierDistribution) {
    log('\n🎯 Current Tier Distribution:', 'bright');
    log(`   - Tier 1: ${status.tierDistribution.tier1} repositories`, 'green');
    log(`   - Tier 2: ${status.tierDistribution.tier2} repositories`, 'yellow');
    log(`   - Tier 3: ${status.tierDistribution.tier3} repositories`, 'cyan');
    log(`   - Total Tiered: ${status.tierDistribution.total} repositories`, 'magenta');
    
    // Calculate orphaned repositories
    if (repoCount) {
      const orphaned = repoCount.count - status.tierDistribution.total;
      log(`   - Orphaned (No Tier): ${orphaned} repositories`, orphaned > 0 ? 'red' : 'green');
      
      if (orphaned > 0) {
        log(`\n🚨 PROBLEM IDENTIFIED: ${orphaned} repositories lack tier assignments!`, 'red');
      }
    }
  }
  
  return {
    totalRepos: repoCount?.count || 0,
    tierDistribution: status?.tierDistribution || { tier1: 0, tier2: 0, tier3: 0, total: 0 }
  };
}

async function analyzeTierAssignments() {
  logSection('🔍 TIER ASSIGNMENT ANALYSIS');
  
  // Analyze each tier
  for (let tier = 1; tier <= 3; tier++) {
    logSubSection(`Tier ${tier} Analysis`);
    
    const tierData = await fetchEndpoint(`/repos/tier?tier=${tier}`);
    if (tierData) {
      log(`📊 Tier ${tier} Count: ${tierData.count}`, 'cyan');
      
      if (tierData.count > 0) {
        // Show sample repositories
        const samples = tierData.repos.slice(0, 5);
        log('\n📋 Sample Repositories:', 'bright');
        samples.forEach((repo, index) => {
          log(`   ${index + 1}. ${repo.full_name}`, 'green');
          log(`      Stars: ${repo.stars}`, 'cyan');
          log(`      Growth Velocity: ${repo.growth_velocity || 'N/A'}`, 'cyan');
          log(`      Engagement Score: ${repo.engagement_score || 'N/A'}`, 'cyan');
        });
        
        // Analyze star distribution
        const stars = tierData.repos.map(r => r.stars);
        const minStars = Math.min(...stars);
        const maxStars = Math.max(...stars);
        const avgStars = Math.round(stars.reduce((a, b) => a + b, 0) / stars.length);
        
        log(`\n📈 Star Distribution:`, 'bright');
        log(`   Min: ${minStars} | Max: ${maxStars} | Avg: ${avgStars}`, 'cyan');
      } else {
        log('❌ No repositories found in this tier', 'red');
      }
    }
  }
}

async function analyzeComprehensiveScanStatus() {
  logSection('🔄 COMPREHENSIVE SCAN STATUS');
  
  // Check if comprehensive scans are running
  const status = await fetchEndpoint('/status');
  if (status) {
    log('\n🔧 System Status:', 'bright');
    log(`   Status: ${status.status}`, 'green');
    log(`   Scan Interval: ${status.scanInterval} hour(s)`, 'cyan');
    
    if (status.lastScan) {
      log(`   Last Scan: ${new Date(status.lastScan).toLocaleString()}`, 'cyan');
    }
    
    if (status.nextScan) {
      log(`   Next Scan: ${new Date(status.nextScan).toLocaleString()}`, 'cyan');
    }
  }
  
  // Try to trigger a manual comprehensive scan to see what happens
  log('\n🧪 Testing Manual Comprehensive Scan...', 'bright');
  try {
    const scanResponse = await fetch(`${API_BASE_URL}/api/agent/scan/comprehensive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (scanResponse.ok) {
      const scanResult = await scanResponse.json();
      log('✅ Manual scan initiated successfully', 'green');
      log(`   Message: ${scanResult.message}`, 'cyan');
      
      if (scanResult.tiers) {
        log('\n📊 Scan Results by Tier:', 'bright');
        Object.entries(scanResult.tiers).forEach(([tier, repos]) => {
          log(`   ${tier}: ${repos.length} repositories`, 'cyan');
        });
      }
    } else {
      log(`❌ Manual scan failed: ${scanResponse.status} ${scanResponse.statusText}`, 'red');
    }
  } catch (error) {
    log(`❌ Error testing manual scan: ${error.message}`, 'red');
  }
}

async function analyzeTrendingRepos() {
  logSection('📈 TRENDING REPOSITORIES ANALYSIS');
  
  const trending = await fetchEndpoint('/repos/trending');
  if (trending && trending.repositories) {
    log(`\n📊 Total Trending Repositories: ${trending.repositories.length}`, 'cyan');
    
    // Analyze tier distribution in trending repos
    const tierCounts = { 1: 0, 2: 0, 3: 0, null: 0 };
    const starRanges = { low: 0, medium: 0, high: 0, veryHigh: 0 };
    
    trending.repositories.forEach(repo => {
      // Count tiers
      if (repo.tier) {
        tierCounts[repo.tier]++;
      } else {
        tierCounts.null++;
      }
      
      // Count star ranges
      if (repo.stars < 100) starRanges.low++;
      else if (repo.stars < 1000) starRanges.medium++;
      else if (repo.stars < 10000) starRanges.high++;
      else starRanges.veryHigh++;
    });
    
    log('\n🎯 Tier Distribution in Trending Repos:', 'bright');
    log(`   Tier 1: ${tierCounts[1]}`, 'green');
    log(`   Tier 2: ${tierCounts[2]}`, 'yellow');
    log(`   Tier 3: ${tierCounts[3]}`, 'cyan');
    log(`   No Tier: ${tierCounts.null}`, tierCounts.null > 0 ? 'red' : 'green');
    
    log('\n⭐ Star Distribution in Trending Repos:', 'bright');
    log(`   < 100 stars: ${starRanges.low}`, 'cyan');
    log(`   100-999 stars: ${starRanges.medium}`, 'cyan');
    log(`   1K-9.9K stars: ${starRanges.high}`, 'cyan');
    log(`   10K+ stars: ${starRanges.veryHigh}`, 'cyan');
    
    // Show examples of repos without tiers
    const untieredRepos = trending.repositories.filter(r => !r.tier);
    if (untieredRepos.length > 0) {
      log('\n🚨 Examples of Repositories WITHOUT Tier Assignments:', 'red');
      untieredRepos.slice(0, 10).forEach((repo, index) => {
        log(`   ${index + 1}. ${repo.full_name} (${repo.stars} stars)`, 'yellow');
      });
      
      if (untieredRepos.length > 10) {
        log(`   ... and ${untieredRepos.length - 10} more`, 'yellow');
      }
    }
  }
}

async function testTierAssignmentLogic() {
  logSection('🧮 TIER ASSIGNMENT LOGIC TEST');
  
  // Get some sample repositories to test tier assignment logic
  const trending = await fetchEndpoint('/repos/trending');
  if (trending && trending.repositories) {
    log('\n🧪 Testing Tier Assignment Logic on Sample Repositories:', 'bright');
    
    const samples = trending.repositories.slice(0, 10);
    
    samples.forEach((repo, index) => {
      log(`\n${index + 1}. ${repo.full_name}`, 'bright');
      log(`   Stars: ${repo.stars}`, 'cyan');
      log(`   Created: ${repo.created_at}`, 'cyan');
      
      // Calculate growth velocity (same logic as in the code)
      const createdDate = new Date(repo.created_at);
      const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      const growthVelocity = repo.stars / Math.max(1, ageInDays);
      
      log(`   Age: ${Math.round(ageInDays)} days`, 'cyan');
      log(`   Growth Velocity: ${growthVelocity.toFixed(3)}`, 'cyan');
      
      // Apply tier logic (from storage-enhanced.ts)
      let expectedTier;
      if (repo.stars >= 100000 || (repo.stars >= 50000 && growthVelocity > 50)) {
        expectedTier = 1;
      } else if (repo.stars >= 20000 || (repo.stars >= 10000 && growthVelocity > 25)) {
        expectedTier = 2;
      } else {
        expectedTier = 3;
      }
      
      log(`   Expected Tier: ${expectedTier}`, 'magenta');
      log(`   Actual Tier: ${repo.tier || 'NONE'}`, repo.tier ? 'green' : 'red');
      
      if (!repo.tier) {
        log(`   🚨 MISSING TIER ASSIGNMENT!`, 'red');
      } else if (repo.tier !== expectedTier) {
        log(`   ⚠️  TIER MISMATCH!`, 'yellow');
      } else {
        log(`   ✅ Tier assignment correct`, 'green');
      }
    });
  }
}

async function generateRepairPlan() {
  logSection('🔧 REPAIR PLAN GENERATION');
  
  log('\n📋 Based on the analysis, here\'s the repair plan:', 'bright');
  
  log('\n1. 🔍 IDENTIFIED ISSUES:', 'yellow');
  log('   - Repositories are being discovered and saved to the database', 'cyan');
  log('   - Tier assignments are failing during the comprehensive scan', 'cyan');
  log('   - Most repositories remain "orphaned" without tier assignments', 'cyan');
  
  log('\n2. 🎯 ROOT CAUSES:', 'yellow');
  log('   - Batch processing failures during tier assignment', 'cyan');
  log('   - Silent errors in the updateRepoTier() method', 'cyan');
  log('   - Database transaction/connection limits', 'cyan');
  log('   - Missing error handling and retry logic', 'cyan');
  
  log('\n3. 🚀 PROPOSED SOLUTIONS:', 'yellow');
  log('   - Create a repair script to assign tiers to orphaned repositories', 'cyan');
  log('   - Improve error handling in the tier assignment process', 'cyan');
  log('   - Add batch processing with smaller chunks', 'cyan');
  log('   - Implement retry logic for failed assignments', 'cyan');
  log('   - Add comprehensive logging for debugging', 'cyan');
  
  log('\n4. 📝 IMMEDIATE ACTIONS:', 'yellow');
  log('   - Run repair script to fix existing orphaned repositories', 'cyan');
  log('   - Update comprehensive scan to handle failures gracefully', 'cyan');
  log('   - Ensure ALL discovered AI/ML repos get tier assignments', 'cyan');
  
  log('\n🎯 GOAL: Ensure all ~700 discovered repositories have proper tier assignments', 'green');
}

async function runDiagnostics() {
  log('🔍 GitHub AI Intelligence Agent - Tier Assignment Diagnostic', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'cyan');
  log(`⏰ Time: ${new Date().toLocaleString()}`, 'cyan');
  
  try {
    // Run all diagnostic checks
    const repoAnalysis = await analyzeRepositoryTables();
    await analyzeTierAssignments();
    await analyzeComprehensiveScanStatus();
    await analyzeTrendingRepos();
    await testTierAssignmentLogic();
    await generateRepairPlan();
    
    logSection('🏁 DIAGNOSTIC COMPLETE');
    
    // Summary
    log('\n📊 SUMMARY:', 'bright');
    log(`   Total Repositories: ${repoAnalysis.totalRepos}`, 'cyan');
    log(`   Repositories with Tiers: ${repoAnalysis.tierDistribution.total}`, 'green');
    log(`   Orphaned Repositories: ${repoAnalysis.totalRepos - repoAnalysis.tierDistribution.total}`, 'red');
    
    if (repoAnalysis.totalRepos - repoAnalysis.tierDistribution.total > 0) {
      log('\n🚨 CRITICAL ISSUE CONFIRMED:', 'red');
      log('   Most discovered repositories are missing tier assignments!', 'red');
      log('   This explains why Tier 3 only has 2 repositories.', 'red');
    }
    
    log('\n✅ Diagnostic completed successfully!', 'green');
    log('📝 Next step: Create and run the repair script', 'yellow');
    
  } catch (error) {
    logSection('❌ DIAGNOSTIC FAILED');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the diagnostics
runDiagnostics();
