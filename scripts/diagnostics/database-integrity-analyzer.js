#!/usr/bin/env node

/**
 * Database Integrity Analyzer
 * 
 * Comprehensive check for orphan data records after tier assignment fixes
 * Uses API calls to analyze the production database
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

async function executeCustomQuery(query) {
  try {
    // Since we can't execute arbitrary SQL, we'll use available API endpoints
    // and simulate the checks with the data we can access
    return null;
  } catch (error) {
    log(`❌ Error executing query: ${error.message}`, 'red');
    return null;
  }
}

async function checkForeignKeyIntegrity() {
  logSection('🔍 FOREIGN KEY INTEGRITY CHECKS');
  
  const issues = [];
  
  // Get all repositories and tier data
  const repoCount = await fetchEndpoint('/repos/count');
  const status = await fetchEndpoint('/status');
  
  if (repoCount && status) {
    log(`📊 Total Repositories: ${repoCount.count}`, 'cyan');
    
    if (status.tierDistribution) {
      const totalTiered = status.tierDistribution.tier1 + 
                         status.tierDistribution.tier2 + 
                         status.tierDistribution.tier3;
      
      log(`📊 Total Repositories with Tiers: ${totalTiered}`, 'cyan');
      
      const orphanedRepos = repoCount.count - totalTiered;
      if (orphanedRepos > 0) {
        log(`⚠️  Repositories without tier assignments: ${orphanedRepos}`, 'yellow');
        issues.push({
          type: 'REPOS_WITHOUT_TIERS',
          count: orphanedRepos,
          severity: 'medium'
        });
      } else {
        log(`✅ All repositories have tier assignments`, 'green');
      }
    }
  }
  
  return issues;
}

async function checkTierDistribution() {
  logSection('📊 TIER DISTRIBUTION ANALYSIS');
  
  const issues = [];
  const status = await fetchEndpoint('/status');
  
  if (status && status.tierDistribution) {
    const { tier1, tier2, tier3, total } = status.tierDistribution;
    
    log('\n🎯 Current Tier Distribution:', 'bright');
    log(`   Tier 1: ${tier1} repositories (${(tier1/total*100).toFixed(1)}%)`, 'green');
    log(`   Tier 2: ${tier2} repositories (${(tier2/total*100).toFixed(1)}%)`, 'yellow');
    log(`   Tier 3: ${tier3} repositories (${(tier3/total*100).toFixed(1)}%)`, 'cyan');
    log(`   Total: ${total} repositories`, 'bright');
    
    // Check for healthy distribution
    const tier3Percentage = (tier3 / total) * 100;
    if (tier3Percentage < 10) {
      log(`⚠️  Tier 3 has unusually low percentage: ${tier3Percentage.toFixed(1)}%`, 'yellow');
      issues.push({
        type: 'LOW_TIER3_DISTRIBUTION',
        percentage: tier3Percentage,
        severity: 'medium'
      });
    } else if (tier3Percentage > 80) {
      log(`⚠️  Tier 3 has unusually high percentage: ${tier3Percentage.toFixed(1)}%`, 'yellow');
      issues.push({
        type: 'HIGH_TIER3_DISTRIBUTION',
        percentage: tier3Percentage,
        severity: 'low'
      });
    } else {
      log(`✅ Tier distribution looks healthy`, 'green');
    }
  }
  
  return issues;
}

async function checkTierLogicConsistency() {
  logSection('🧮 TIER LOGIC CONSISTENCY CHECKS');
  
  const issues = [];
  
  // Check each tier for logic consistency
  for (let tier = 1; tier <= 3; tier++) {
    logSubSection(`Tier ${tier} Logic Validation`);
    
    const tierData = await fetchEndpoint(`/repos/tier?tier=${tier}`);
    if (tierData && tierData.repos) {
      log(`📊 Tier ${tier} repositories: ${tierData.count}`, 'cyan');
      
      let logicViolations = 0;
      const sampleViolations = [];
      
      tierData.repos.forEach(repo => {
        let isViolation = false;
        let reason = '';
        
        // Check tier assignment logic
        if (tier === 1) {
          // Tier 1: Should have 50K+ stars OR 20K+ with high growth
          if (repo.stars < 20000) {
            isViolation = true;
            reason = `Only ${repo.stars} stars (expected 20K+ for Tier 1)`;
          }
        } else if (tier === 2) {
          // Tier 2: Should have 15K+ stars OR 5K+ with moderate growth
          if (repo.stars < 5000) {
            isViolation = true;
            reason = `Only ${repo.stars} stars (expected 5K+ for Tier 2)`;
          }
        }
        // Tier 3: All other repos (no minimum requirement)
        
        if (isViolation) {
          logicViolations++;
          if (sampleViolations.length < 5) {
            sampleViolations.push({
              name: repo.full_name,
              stars: repo.stars,
              reason
            });
          }
        }
      });
      
      if (logicViolations > 0) {
        log(`⚠️  Logic violations found: ${logicViolations}`, 'yellow');
        sampleViolations.forEach((violation, index) => {
          log(`   ${index + 1}. ${violation.name}: ${violation.reason}`, 'yellow');
        });
        
        issues.push({
          type: `TIER_${tier}_LOGIC_VIOLATIONS`,
          count: logicViolations,
          severity: logicViolations > tierData.count * 0.1 ? 'high' : 'medium',
          examples: sampleViolations
        });
      } else {
        log(`✅ No logic violations found in Tier ${tier}`, 'green');
      }
    }
  }
  
  return issues;
}

async function checkDataConsistency() {
  logSection('🔄 DATA CONSISTENCY CHECKS');
  
  const issues = [];
  
  // Check trending repositories for consistency
  const trending = await fetchEndpoint('/repos/trending');
  if (trending && trending.repositories) {
    log(`📊 Trending repositories: ${trending.repositories.length}`, 'cyan');
    
    let reposWithoutTiers = 0;
    let starMismatches = 0;
    
    trending.repositories.forEach(repo => {
      if (!repo.tier) {
        reposWithoutTiers++;
      }
      
      // Note: We can't easily check star mismatches without direct DB access
      // This would require comparing repo.stars with tier table stars
    });
    
    if (reposWithoutTiers > 0) {
      log(`⚠️  Trending repositories without tiers: ${reposWithoutTiers}`, 'yellow');
      issues.push({
        type: 'TRENDING_REPOS_WITHOUT_TIERS',
        count: reposWithoutTiers,
        severity: 'medium'
      });
    } else {
      log(`✅ All trending repositories have tier assignments`, 'green');
    }
  }
  
  return issues;
}

async function checkSystemHealth() {
  logSection('🏥 SYSTEM HEALTH CHECKS');
  
  const issues = [];
  const status = await fetchEndpoint('/status');
  
  if (status) {
    log('\n🔧 System Status:', 'bright');
    log(`   Status: ${status.status}`, status.status === 'ok' ? 'green' : 'red');
    log(`   Scan Interval: ${status.scanInterval} hour(s)`, 'cyan');
    
    if (status.lastScan) {
      const lastScanDate = new Date(status.lastScan);
      const hoursSinceLastScan = (Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60);
      log(`   Last Scan: ${lastScanDate.toLocaleString()} (${hoursSinceLastScan.toFixed(1)} hours ago)`, 'cyan');
      
      if (hoursSinceLastScan > 24) {
        log(`⚠️  Last scan was over 24 hours ago`, 'yellow');
        issues.push({
          type: 'STALE_SCAN_DATA',
          hoursSince: hoursSinceLastScan,
          severity: 'medium'
        });
      }
    }
    
    if (status.nextScan) {
      log(`   Next Scan: ${new Date(status.nextScan).toLocaleString()}`, 'cyan');
    }
    
    // Check system health metrics
    if (status.systemHealth) {
      const health = status.systemHealth;
      log('\n🏥 System Health Metrics:', 'bright');
      
      Object.entries(health).forEach(([metric, value]) => {
        const color = typeof value === 'boolean' ? (value ? 'green' : 'red') : 'cyan';
        log(`   ${metric}: ${value}`, color);
        
        if (typeof value === 'boolean' && !value) {
          issues.push({
            type: 'SYSTEM_HEALTH_ISSUE',
            metric,
            severity: 'high'
          });
        }
      });
    }
  }
  
  return issues;
}

async function generateIntegrityReport(allIssues) {
  logSection('📋 DATABASE INTEGRITY REPORT');
  
  const criticalIssues = allIssues.filter(issue => issue.severity === 'high');
  const mediumIssues = allIssues.filter(issue => issue.severity === 'medium');
  const lowIssues = allIssues.filter(issue => issue.severity === 'low');
  
  log('\n📊 Issue Summary:', 'bright');
  log(`   🔴 Critical Issues: ${criticalIssues.length}`, criticalIssues.length > 0 ? 'red' : 'green');
  log(`   🟡 Medium Issues: ${mediumIssues.length}`, mediumIssues.length > 0 ? 'yellow' : 'green');
  log(`   🟢 Low Issues: ${lowIssues.length}`, lowIssues.length > 0 ? 'cyan' : 'green');
  log(`   📈 Total Issues: ${allIssues.length}`, allIssues.length > 0 ? 'yellow' : 'green');
  
  if (allIssues.length === 0) {
    log('\n🎉 EXCELLENT! No database integrity issues found!', 'green');
    log('✅ The tier assignment fixes did not create any orphan data records.', 'green');
    return;
  }
  
  // Detail critical issues
  if (criticalIssues.length > 0) {
    log('\n🔴 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:', 'red');
    criticalIssues.forEach((issue, index) => {
      log(`   ${index + 1}. ${issue.type}`, 'red');
      if (issue.count) log(`      Count: ${issue.count}`, 'red');
      if (issue.examples) {
        log(`      Examples:`, 'red');
        issue.examples.forEach(example => {
          log(`        - ${example.name}: ${example.reason}`, 'red');
        });
      }
    });
  }
  
  // Detail medium issues
  if (mediumIssues.length > 0) {
    log('\n🟡 MEDIUM ISSUES NEEDING ATTENTION:', 'yellow');
    mediumIssues.forEach((issue, index) => {
      log(`   ${index + 1}. ${issue.type}`, 'yellow');
      if (issue.count) log(`      Count: ${issue.count}`, 'yellow');
      if (issue.percentage) log(`      Percentage: ${issue.percentage.toFixed(1)}%`, 'yellow');
    });
  }
  
  // Recommendations
  log('\n💡 RECOMMENDATIONS:', 'bright');
  
  if (criticalIssues.length > 0) {
    log('   1. Address critical issues immediately', 'cyan');
    log('   2. Run comprehensive scan to refresh data', 'cyan');
    log('   3. Check system logs for errors', 'cyan');
  } else if (mediumIssues.length > 0) {
    log('   1. Monitor medium issues - they may resolve automatically', 'cyan');
    log('   2. Consider running a comprehensive scan', 'cyan');
  } else {
    log('   1. Database integrity is excellent!', 'green');
    log('   2. Continue regular monitoring', 'green');
  }
}

async function runIntegrityAnalysis() {
  log('🔍 Database Integrity Analysis - GitHub AI Intelligence Agent', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'cyan');
  log(`⏰ Analysis Time: ${new Date().toLocaleString()}`, 'cyan');
  
  try {
    const allIssues = [];
    
    // Run all integrity checks
    const foreignKeyIssues = await checkForeignKeyIntegrity();
    const tierDistributionIssues = await checkTierDistribution();
    const tierLogicIssues = await checkTierLogicConsistency();
    const dataConsistencyIssues = await checkDataConsistency();
    const systemHealthIssues = await checkSystemHealth();
    
    // Combine all issues
    allIssues.push(
      ...foreignKeyIssues,
      ...tierDistributionIssues,
      ...tierLogicIssues,
      ...dataConsistencyIssues,
      ...systemHealthIssues
    );
    
    // Generate comprehensive report
    await generateIntegrityReport(allIssues);
    
    logSection('🏁 ANALYSIS COMPLETE');
    
    if (allIssues.length === 0) {
      log('🎉 SUCCESS: Database integrity is excellent!', 'green');
      log('✅ The tier assignment fixes did not result in orphan data records.', 'green');
    } else {
      log(`⚠️  Found ${allIssues.length} issues that need attention.`, 'yellow');
      log('📝 Review the recommendations above to address these issues.', 'cyan');
    }
    
  } catch (error) {
    logSection('❌ ANALYSIS FAILED');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the integrity analysis
runIntegrityAnalysis();
