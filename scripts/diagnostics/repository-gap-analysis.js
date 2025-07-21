#!/usr/bin/env node

/**
 * Repository Gap Analysis Tool
 * 
 * Identifies repositories that exist in the repositories table but are missing
 * from the repo_tiers table. This will help us understand why only 202 out of
 * ~700 discovered repositories have tier assignments.
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

async function analyzeRepositoryGap() {
  logSection('🔍 REPOSITORY GAP ANALYSIS');
  
  // Get total repository count
  const repoCount = await fetchEndpoint('/repos/count');
  if (!repoCount) {
    log('❌ Could not fetch repository count', 'red');
    return;
  }
  
  log(`📊 Total Repositories in Database: ${repoCount.count}`, 'cyan');
  
  // Get tier distribution
  const status = await fetchEndpoint('/status');
  if (!status || !status.tierDistribution) {
    log('❌ Could not fetch tier distribution', 'red');
    return;
  }
  
  const { tier1, tier2, tier3 } = status.tierDistribution;
  const totalTiered = tier1 + tier2 + tier3;
  const missingTiers = repoCount.count - totalTiered;
  
  log(`📊 Repositories with Tier Assignments: ${totalTiered}`, 'cyan');
  log(`🚨 Repositories WITHOUT Tier Assignments: ${missingTiers}`, missingTiers > 0 ? 'red' : 'green');
  
  if (missingTiers > 0) {
    const missingPercentage = (missingTiers / repoCount.count) * 100;
    log(`📈 Percentage Missing Tiers: ${missingPercentage.toFixed(1)}%`, 'red');
    
    log('\n🎯 This confirms the issue:', 'bright');
    log(`   - ${missingTiers} repositories are discovered but not assigned to any tier`, 'red');
    log(`   - These should ALL be in Tier 3 (catch-all tier)`, 'red');
    log(`   - This represents a major gap in the tier assignment pipeline`, 'red');
  }
  
  return {
    totalRepos: repoCount.count,
    tieredRepos: totalTiered,
    missingTiers,
    missingPercentage: (missingTiers / repoCount.count) * 100
  };
}

async function analyzeTierDistribution() {
  logSection('📊 DETAILED TIER ANALYSIS');
  
  const status = await fetchEndpoint('/status');
  if (!status || !status.tierDistribution) {
    log('❌ Could not fetch tier distribution', 'red');
    return;
  }
  
  const { tier1, tier2, tier3 } = status.tierDistribution;
  const total = tier1 + tier2 + tier3;
  
  log('\n🎯 Current Tier Distribution:', 'bright');
  log(`   Tier 1: ${tier1} repositories (${(tier1/total*100).toFixed(1)}%)`, 'green');
  log(`   Tier 2: ${tier2} repositories (${(tier2/total*100).toFixed(1)}%)`, 'yellow');
  log(`   Tier 3: ${tier3} repositories (${(tier3/total*100).toFixed(1)}%)`, 'cyan');
  
  log('\n📈 Expected Distribution (if all repos were tiered):', 'bright');
  const repoCount = await fetchEndpoint('/repos/count');
  if (repoCount) {
    const expectedTier1 = Math.round(repoCount.count * 0.15); // 15%
    const expectedTier2 = Math.round(repoCount.count * 0.25); // 25%
    const expectedTier3 = repoCount.count - expectedTier1 - expectedTier2; // 60%
    
    log(`   Expected Tier 1: ${expectedTier1} repositories (15%)`, 'green');
    log(`   Expected Tier 2: ${expectedTier2} repositories (25%)`, 'yellow');
    log(`   Expected Tier 3: ${expectedTier3} repositories (60%)`, 'cyan');
    
    log('\n🔍 Gap Analysis:', 'bright');
    log(`   Tier 1 Gap: ${expectedTier1 - tier1} repositories`, tier1 < expectedTier1 ? 'red' : 'green');
    log(`   Tier 2 Gap: ${expectedTier2 - tier2} repositories`, tier2 < expectedTier2 ? 'red' : 'green');
    log(`   Tier 3 Gap: ${expectedTier3 - tier3} repositories`, tier3 < expectedTier3 ? 'red' : 'green');
  }
}

async function sampleMissingRepositories() {
  logSection('🔍 SAMPLE MISSING REPOSITORIES ANALYSIS');
  
  // Since we can't directly query the database, we'll try to infer missing repos
  // by looking at trending repos and checking if any are missing tiers
  const trending = await fetchEndpoint('/repos/trending');
  if (!trending || !trending.repositories) {
    log('❌ Could not fetch trending repositories', 'red');
    return;
  }
  
  log(`📊 Analyzing ${trending.repositories.length} trending repositories...`, 'cyan');
  
  const reposWithoutTiers = trending.repositories.filter(repo => !repo.tier);
  const reposWithTiers = trending.repositories.filter(repo => repo.tier);
  
  log(`✅ Trending repos WITH tiers: ${reposWithTiers.length}`, 'green');
  log(`❌ Trending repos WITHOUT tiers: ${reposWithoutTiers.length}`, reposWithoutTiers.length > 0 ? 'red' : 'green');
  
  if (reposWithoutTiers.length > 0) {
    log('\n🚨 Examples of repositories WITHOUT tier assignments:', 'red');
    reposWithoutTiers.slice(0, 10).forEach((repo, index) => {
      log(`   ${index + 1}. ${repo.full_name}`, 'red');
      log(`      Stars: ${repo.stars}`, 'red');
      log(`      Language: ${repo.language || 'N/A'}`, 'red');
      log(`      Topics: ${repo.topics ? repo.topics.slice(0, 3).join(', ') : 'N/A'}`, 'red');
      
      // Determine what tier this should be in
      let expectedTier = 3; // Default catch-all
      if (repo.stars >= 50000) expectedTier = 1;
      else if (repo.stars >= 15000) expectedTier = 2;
      
      log(`      Expected Tier: ${expectedTier}`, 'yellow');
      log('', 'reset');
    });
  }
  
  // Analyze star distribution of missing repos
  if (reposWithoutTiers.length > 0) {
    const stars = reposWithoutTiers.map(r => r.stars).sort((a, b) => b - a);
    const minStars = Math.min(...stars);
    const maxStars = Math.max(...stars);
    const avgStars = Math.round(stars.reduce((a, b) => a + b, 0) / stars.length);
    
    log('📈 Star Distribution of Missing Repositories:', 'bright');
    log(`   Min: ${minStars} | Max: ${maxStars} | Avg: ${avgStars}`, 'cyan');
    
    // Count by expected tier
    let shouldBeTier1 = 0, shouldBeTier2 = 0, shouldBeTier3 = 0;
    reposWithoutTiers.forEach(repo => {
      if (repo.stars >= 50000) shouldBeTier1++;
      else if (repo.stars >= 15000) shouldBeTier2++;
      else shouldBeTier3++;
    });
    
    log('\n🎯 Where these missing repositories should be assigned:', 'bright');
    log(`   Should be Tier 1: ${shouldBeTier1} repositories`, 'green');
    log(`   Should be Tier 2: ${shouldBeTier2} repositories`, 'yellow');
    log(`   Should be Tier 3: ${shouldBeTier3} repositories`, 'cyan');
  }
}

async function identifyRootCause() {
  logSection('🔍 ROOT CAUSE ANALYSIS');
  
  log('\n🧐 Potential Causes for Missing Tier Assignments:', 'bright');
  
  log('\n1. 📊 INCOMPLETE COMPREHENSIVE SCANS:', 'yellow');
  log('   - Comprehensive scans may be timing out before processing all repos', 'cyan');
  log('   - Rate limiting may prevent processing of all discovered repositories', 'cyan');
  log('   - Batch processing may be incomplete', 'cyan');
  
  log('\n2. 🔍 FILTERING LOGIC ISSUES:', 'yellow');
  log('   - AI/ML relevance filtering may be too restrictive', 'cyan');
  log('   - Repositories may be discovered but filtered out before tier assignment', 'cyan');
  log('   - Quality thresholds may exclude valid repositories', 'cyan');
  
  log('\n3. 💥 SILENT FAILURES:', 'yellow');
  log('   - Tier assignment process may be failing silently for many repos', 'cyan');
  log('   - Database errors may not be properly logged', 'cyan');
  log('   - Network timeouts during tier assignment', 'cyan');
  
  log('\n4. 🔄 PROCESS WORKFLOW GAPS:', 'yellow');
  log('   - Gap between repository discovery and tier assignment', 'cyan');
  log('   - Repositories may be saved to repositories table but never processed', 'cyan');
  log('   - Missing trigger to assign tiers to newly discovered repositories', 'cyan');
  
  // Check system health for clues
  const status = await fetchEndpoint('/status');
  if (status) {
    log('\n🏥 System Health Clues:', 'bright');
    if (status.lastScan) {
      const lastScanDate = new Date(status.lastScan);
      const hoursSince = (Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60);
      log(`   Last Scan: ${lastScanDate.toLocaleString()} (${hoursSince.toFixed(1)} hours ago)`, 'cyan');
    }
    
    if (status.systemHealth) {
      Object.entries(status.systemHealth).forEach(([key, value]) => {
        const color = typeof value === 'boolean' ? (value ? 'green' : 'red') : 'cyan';
        log(`   ${key}: ${value}`, color);
      });
    }
  }
}

async function generateRepairPlan() {
  logSection('🔧 REPAIR PLAN');
  
  log('\n📋 Immediate Actions Required:', 'bright');
  
  log('\n1. 🔍 IDENTIFY MISSING REPOSITORIES:', 'yellow');
  log('   - Create a tool to list all repositories without tier assignments', 'cyan');
  log('   - Export the list of missing repository IDs for batch processing', 'cyan');
  
  log('\n2. 🚀 FORCE TIER ASSIGNMENT:', 'yellow');
  log('   - Create a repair script to assign tiers to ALL missing repositories', 'cyan');
  log('   - Use the existing tier logic (Tier 3 as catch-all)', 'cyan');
  log('   - Process in batches to avoid overwhelming the system', 'cyan');
  
  log('\n3. 🔄 FIX THE PIPELINE:', 'yellow');
  log('   - Examine GitHubAgent comprehensive scan logic', 'cyan');
  log('   - Ensure ALL discovered repositories get processed for tier assignment', 'cyan');
  log('   - Add error handling and retry logic', 'cyan');
  
  log('\n4. 📊 VERIFY RESULTS:', 'yellow');
  log('   - Run comprehensive verification after repairs', 'cyan');
  log('   - Ensure all ~700 repositories have tier assignments', 'cyan');
  log('   - Confirm Tier 3 contains the majority of repositories', 'cyan');
  
  log('\n🎯 Expected Outcome:', 'bright');
  log('   - ALL discovered repositories will have tier assignments', 'green');
  log('   - Tier 3 will contain ~60-70% of all repositories (400-500 repos)', 'green');
  log('   - No more orphaned repositories in the system', 'green');
}

async function runGapAnalysis() {
  log('🔍 Repository Gap Analysis - GitHub AI Intelligence Agent', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'cyan');
  log(`⏰ Analysis Time: ${new Date().toLocaleString()}`, 'cyan');
  
  try {
    // Run all analysis steps
    const gapData = await analyzeRepositoryGap();
    await analyzeTierDistribution();
    await sampleMissingRepositories();
    await identifyRootCause();
    await generateRepairPlan();
    
    logSection('🏁 ANALYSIS COMPLETE');
    
    if (gapData && gapData.missingTiers > 0) {
      log(`🚨 CRITICAL ISSUE CONFIRMED: ${gapData.missingTiers} repositories are missing tier assignments!`, 'red');
      log(`📈 This represents ${gapData.missingPercentage.toFixed(1)}% of all discovered repositories`, 'red');
      log('\n💡 Next Steps:', 'bright');
      log('   1. Create a tier assignment repair tool', 'cyan');
      log('   2. Force assign ALL missing repositories to appropriate tiers', 'cyan');
      log('   3. Fix the comprehensive scan pipeline to prevent future gaps', 'cyan');
    } else {
      log('✅ No repository gap detected - all repositories have tier assignments', 'green');
    }
    
  } catch (error) {
    logSection('❌ ANALYSIS FAILED');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the gap analysis
runGapAnalysis();
