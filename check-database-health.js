#!/usr/bin/env node

/**
 * Database Health Check Script for GitHub AI Intelligence Agent
 * 
 * This script performs comprehensive database health checks including:
 * - Table integrity
 * - Data freshness
 * - Row counts
 * - Schema validation
 */

const API_BASE_URL = process.env.API_URL || 'https://github-ai-intelligence.pages.dev';

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
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

async function fetchEndpoint(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    log(`Error fetching ${endpoint}: ${error.message}`, 'red');
    return null;
  }
}

async function checkTableIntegrity() {
  logSection('TABLE INTEGRITY CHECK');
  
  const data = await fetchEndpoint('/diagnostics/table-check');
  if (!data) return;

  const { tables, summary } = data;
  
  // Summary
  log(`\nTotal Tables: ${summary.total}`, 'cyan');
  log(`✓ Populated: ${summary.populated}`, 'green');
  log(`⚠ Empty: ${summary.empty}`, 'yellow');
  log(`✗ Missing: ${summary.missing}`, 'red');
  
  if (summary.missing > 0) {
    log(`\nMissing Tables: ${summary.missingTableNames.join(', ')}`, 'red');
  }
  
  // Table details
  log('\nTable Details:', 'bright');
  console.table(
    tables.map(t => ({
      Table: t.name,
      'Row Count': t.rowCount === -1 ? 'MISSING' : t.rowCount,
      Status: t.rowCount === -1 ? '✗' : t.rowCount === 0 ? '⚠' : '✓'
    }))
  );
  
  log(`\nTotal Rows Across All Tables: ${summary.totalRows.toLocaleString()}`, 'cyan');
}

async function checkDataFreshness() {
  logSection('DATA FRESHNESS CHECK');
  
  const data = await fetchEndpoint('/diagnostics/data-freshness');
  if (!data) return;

  const { dataFreshness, summary } = data;
  
  // Summary
  log(`\nTotal Repositories: ${summary.total}`, 'cyan');
  log(`✓ Fresh Data: ${summary.fresh}`, 'green');
  log(`✗ Stale Data: ${summary.stale}`, 'red');
  
  // Show stale repos
  const staleRepos = dataFreshness.filter(f => f.isStale);
  if (staleRepos.length > 0) {
    log('\nStale Repositories (need scanning):', 'yellow');
    staleRepos.slice(0, 10).forEach(repo => {
      log(`  - ${repo.name}: Last scan ${formatDuration(repo.hoursSinceLastScan)} ago`, 'yellow');
    });
    if (staleRepos.length > 10) {
      log(`  ... and ${staleRepos.length - 10} more`, 'yellow');
    }
  }
}

async function checkSystemHealth() {
  logSection('SYSTEM HEALTH CHECK');
  
  const data = await fetchEndpoint('/diagnostics/system-health');
  if (!data) return;

  const { health, tierDistribution, quickActions } = data;
  
  // Overall Status
  const overallStatus = health.missingTables.length === 0 ? 'HEALTHY' : 'NEEDS ATTENTION';
  const statusColor = overallStatus === 'HEALTHY' ? 'green' : 'red';
  log(`\nOverall Status: ${overallStatus}`, statusColor);
  
  // Database Status
  log('\nDatabase Status:', 'bright');
  log(`  Tables: ${health.totalTables}`, 'cyan');
  log(`  Missing Tables: ${health.missingTables.length}`, health.missingTables.length > 0 ? 'red' : 'green');
  log(`  Total Rows: ${health.totalRows.toLocaleString()}`, 'cyan');
  
  // Repository Status
  log('\nRepository Status:', 'bright');
  log(`  Total Repos: ${health.totalRepos}`, 'cyan');
  log(`  With Analysis: ${health.reposWithAnalysis}`, 'green');
  log(`  Without Analysis: ${health.totalRepos - health.reposWithAnalysis}`, 'yellow');
  
  // Scan Status
  log('\nScan Status:', 'bright');
  const scanStatusColor = health.lastScanStatus === 'success' ? 'green' : 
                         health.lastScanStatus === 'failed' ? 'red' : 'yellow';
  log(`  Last Scan: ${health.lastScanStatus}`, scanStatusColor);
  if (health.lastScanTime) {
    log(`  Last Scan Time: ${formatTimestamp(health.lastScanTime)}`, 'cyan');
  }
  
  // Tier Distribution
  log('\nRepository Tier Distribution:', 'bright');
  log(`  Tier 1 (Hot Prospects): ${tierDistribution.tier1}`, 'green');
  log(`  Tier 2 (Rising Stars): ${tierDistribution.tier2}`, 'yellow');
  log(`  Tier 3 (Long Tail): ${tierDistribution.tier3}`, 'cyan');
  
  // Quick Actions
  if (quickActions.runMigration || quickActions.initializeAgent || quickActions.checkLogs) {
    log('\nRecommended Actions:', 'bright');
    if (quickActions.runMigration) {
      log('  ⚠ Run database migration to create missing tables', 'yellow');
    }
    if (quickActions.initializeAgent) {
      log('  ⚠ Initialize the agent to start scanning', 'yellow');
    }
    if (quickActions.checkLogs) {
      log('  ⚠ Check logs for scan failure details', 'yellow');
    }
  }
}

async function checkScanHistory() {
  logSection('SCAN HISTORY');
  
  const data = await fetchEndpoint('/diagnostics/scan-history');
  if (!data) return;

  const { scanHistory, summary } = data;
  
  // Summary
  log(`\nRecent Scans Summary:`, 'bright');
  log(`  Successful: ${summary.successfulScans}`, 'green');
  log(`  Failed: ${summary.failedScans}`, 'red');
  log(`  Total Repos Scanned: ${summary.totalReposScanned}`, 'cyan');
  log(`  Total Analyses: ${summary.totalAnalyses}`, 'cyan');
  
  // Recent scan details
  if (scanHistory.length > 0) {
    log('\nRecent Scan Details:', 'bright');
    scanHistory.slice(0, 5).forEach(scan => {
      const statusIcon = scan.success ? '✓' : '✗';
      const statusColor = scan.success ? 'green' : 'red';
      log(`\n  ${statusIcon} ${formatTimestamp(scan.timestamp)}`, statusColor);
      log(`     Type: ${scan.scanType}`, 'cyan');
      log(`     Repos Scanned: ${scan.reposScanned}`, 'cyan');
      log(`     Analyses: ${scan.analysesPerformed}`, 'cyan');
      log(`     Duration: ${scan.duration}ms`, 'cyan');
      if (scan.error) {
        log(`     Error: ${scan.error}`, 'red');
      }
    });
  }
}

async function checkRepoCount() {
  logSection('REPOSITORY COUNT');
  
  const data = await fetchEndpoint('/repos/count');
  if (!data) return;

  log(`\nTotal Repositories in Database: ${data.count}`, 'cyan');
}

async function checkStatus() {
  logSection('SYSTEM STATUS');
  
  const data = await fetchEndpoint('/status');
  if (!data) return;

  // System Info
  log('\nSystem Information:', 'bright');
  log(`  Status: ${data.status}`, 'green');
  log(`  Environment: ${data.environment}`, 'cyan');
  log(`  Scan Interval: ${data.scanInterval} hour(s)`, 'cyan');
  
  // Rate Limits
  log('\nAPI Rate Limits:', 'bright');
  Object.entries(data.rateLimits).forEach(([api, limit]) => {
    const usage = limit.used / limit.limit;
    const color = usage > 0.8 ? 'red' : usage > 0.5 ? 'yellow' : 'green';
    log(`  ${api}: ${limit.used}/${limit.limit} (${(usage * 100).toFixed(0)}%) - ${limit.description}`, color);
  });
  
  // Performance
  if (data.performance) {
    log('\nPerformance Metrics:', 'bright');
    log(`  Total Time: ${data.performance.totalTime}ms`, 'cyan');
    log(`  Checkpoints: ${data.performance.checkpoints}`, 'cyan');
    log(`  Warnings: ${data.performance.warnings}`, data.performance.warnings > 0 ? 'yellow' : 'green');
  }
}

async function runAllChecks() {
  log('GitHub AI Intelligence Agent - Database Health Check', 'bright');
  log(`Checking: ${API_BASE_URL}`, 'cyan');
  log(`Time: ${new Date().toLocaleString()}`, 'cyan');
  
  try {
    await checkTableIntegrity();
    await checkDataFreshness();
    await checkSystemHealth();
    await checkScanHistory();
    await checkRepoCount();
    await checkStatus();
    
    logSection('HEALTH CHECK COMPLETE');
    log('All checks completed successfully!', 'green');
  } catch (error) {
    logSection('ERROR');
    log(`Failed to complete health check: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the checks
runAllChecks();
