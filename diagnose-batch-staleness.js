#!/usr/bin/env node

/**
 * Batch Analysis Staleness Diagnostic
 * 
 * Shows which repositories would be included in a batch analysis
 * and why the batch might be completing so quickly.
 */

const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

// ANSI colors
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

async function main() {
  header('🔍 BATCH ANALYSIS STALENESS DIAGNOSTIC');
  
  try {
    // 1. Check what the batch endpoint would return
    log('\n📊 Simulating Batch Analysis Request (Normal Mode)...', 'cyan');
    const normalBatchResponse = await fetch(`${WORKER_URL}/api/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'visible', force: false })
    });
    
    const normalBatch = await normalBatchResponse.json();
    
    console.log('\n📦 Normal Mode Results:');
    if (normalBatch.batchId) {
      log(`  ✅ Would create batch: ${normalBatch.batchId}`, 'green');
      log(`  📋 Repositories to analyze: ${normalBatch.total || normalBatch.repositories?.length || 0}`, 'bright');
      
      if (normalBatch.repositories && normalBatch.repositories.length > 0) {
        log(`\n  Repositories selected for analysis:`, 'yellow');
        normalBatch.repositories.forEach((repo, idx) => {
          log(`    ${idx + 1}. ${repo.full_name} (Tier ${repo.tier}, ${repo.stars} stars)`, 'blue');
        });
      }
    } else {
      log(`  ⚠️  No batch would be created`, 'yellow');
      log(`  Reason: ${normalBatch.reason || 'Unknown'}`, 'magenta');
      
      if (normalBatch.analysisStats) {
        console.log('\n  📊 Current Analysis Coverage:');
        log(`    Tier 1: ${normalBatch.analysisStats.tier1}`, 'red');
        log(`    Tier 2: ${normalBatch.analysisStats.tier2}`, 'yellow');
        log(`    Tier 3: ${normalBatch.analysisStats.tier3}`, 'green');
      }
    }
    
    // 2. Check with force mode
    log('\n\n🔥 Simulating Batch Analysis Request (Force Mode)...', 'cyan');
    const forceBatchResponse = await fetch(`${WORKER_URL}/api/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'visible', force: true })
    });
    
    const forceBatch = await forceBatchResponse.json();
    
    console.log('\n📦 Force Mode Results:');
    if (forceBatch.batchId) {
      log(`  ✅ Would create batch: ${forceBatch.batchId}`, 'green');
      log(`  📋 Repositories to analyze: ${forceBatch.total || forceBatch.repositories?.length || 0}`, 'bright');
      
      if (forceBatch.repositories && forceBatch.repositories.length > 0) {
        log(`\n  First 10 repositories that would be analyzed:`, 'yellow');
        forceBatch.repositories.slice(0, 10).forEach((repo, idx) => {
          log(`    ${idx + 1}. ${repo.full_name} (Tier ${repo.tier}, ${repo.stars} stars)`, 'blue');
        });
        
        if (forceBatch.repositories.length > 10) {
          log(`    ... and ${forceBatch.repositories.length - 10} more`, 'cyan');
        }
      }
    } else {
      log(`  ⚠️  No batch would be created even in force mode`, 'yellow');
      log(`  Reason: ${forceBatch.reason}`, 'magenta');
    }
    
    // 3. Get trending repos to check their analysis ages
    log('\n\n📈 Checking Analysis Ages for Trending Repos...', 'cyan');
    const trendingResponse = await fetch(`${WORKER_URL}/api/repos/trending`);
    const trending = await trendingResponse.json();
    
    const repos = trending.repositories || [];
    const analyzed = repos.filter(r => r.latest_analysis);
    
    console.log('\n🔬 Analysis Age Distribution:');
    log(`  Total Trending: ${repos.length}`, 'bright');
    log(`  With Analysis: ${analyzed.length} (${((analyzed.length/repos.length)*100).toFixed(1)}%)`, 'green');
    log(`  Without Analysis: ${repos.length - analyzed.length}`, 'yellow');
    
    if (analyzed.length > 0) {
      // Calculate age buckets
      const now = Date.now();
      const ageBuckets = {
        '< 1 day': 0,
        '1-3 days': 0,
        '3-7 days': 0,
        '7-14 days': 0,
        '> 14 days': 0,
        'no analysis': 0
      };
      
      repos.forEach(repo => {
        if (!repo.latest_analysis?.metadata?.timestamp) {
          ageBuckets['no analysis']++;
          return;
        }
        
        const ageMs = now - new Date(repo.latest_analysis.metadata.timestamp).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        
        if (ageDays < 1) ageBuckets['< 1 day']++;
        else if (ageDays < 3) ageBuckets['1-3 days']++;
        else if (ageDays < 7) ageBuckets['3-7 days']++;
        else if (ageDays < 14) ageBuckets['7-14 days']++;
        else ageBuckets['> 14 days']++;
      });
      
      console.log('\n  Analysis Age Buckets:');
      Object.entries(ageBuckets).forEach(([bucket, count]) => {
        if (count > 0) {
          const percentage = ((count / repos.length) * 100).toFixed(1);
          log(`    ${bucket}: ${count} repos (${percentage}%)`, 
            bucket === '> 14 days' || bucket === 'no analysis' ? 'red' : 
            bucket === '7-14 days' ? 'yellow' : 'green');
        }
      });
    }
    
    // 4. Show staleness thresholds
    header('📏 STALENESS THRESHOLD CONFIGURATION');
    
    console.log('\n⏰ Normal Mode Thresholds:');
    log('  Tier 1: 168 hours (7 days)', 'red');
    log('  Tier 2: 240 hours (10 days)', 'yellow');
    log('  Tier 3: 336 hours (14 days)', 'green');
    
    console.log('\n🔥 Force Mode Thresholds:');
    log('  Tier 1: 72 hours (3 days)', 'red');
    log('  Tier 2: 120 hours (5 days)', 'yellow');
    log('  Tier 3: 168 hours (7 days)', 'green');
    
    // 5. Summary and recommendation
    header('💡 DIAGNOSIS SUMMARY');
    
    const needsAnalysisNormal = normalBatch.total || normalBatch.repositories?.length || 0;
    const needsAnalysisForce = forceBatch.total || forceBatch.repositories?.length || 0;
    
    console.log('\n📊 What Would Happen:');
    log(`  Normal Mode: ${needsAnalysisNormal} repos would be analyzed`, 
      needsAnalysisNormal > 0 ? 'green' : 'yellow');
    log(`  Force Mode: ${needsAnalysisForce} repos would be analyzed`, 
      needsAnalysisForce > 0 ? 'green' : 'yellow');
    
    console.log('\n🎯 Why Batch Completes So Fast:');
    if (needsAnalysisNormal === 0) {
      log('  ✓ All repositories have RECENT analyses', 'green');
      log('  ✓ They are within the staleness thresholds', 'green');
      log('  ✓ Batch completes instantly because nothing needs analysis', 'yellow');
      log('  ✓ Tier counters don\'t update because no new analyses are performed', 'yellow');
    } else {
      log(`  ✓ ${needsAnalysisNormal} repositories would actually be analyzed`, 'green');
      log('  ⚠️  Something else might be wrong if counters still don\'t update', 'red');
    }
    
    console.log('\n💡 Recommendations:');
    if (needsAnalysisNormal === 0 && needsAnalysisForce > 0) {
      log('  1. Use Force Mode to re-analyze recent repositories', 'cyan');
      log('  2. Enable the "Force scan" checkbox before clicking the button', 'cyan');
      log(`  3. This will re-analyze ${needsAnalysisForce} repositories`, 'cyan');
    } else if (needsAnalysisNormal === 0 && needsAnalysisForce === 0) {
      log('  1. All repositories are VERY recently analyzed', 'green');
      log('  2. System is working perfectly - no re-analysis needed!', 'green');
      log('  3. Wait for repositories to become stale naturally', 'cyan');
    } else {
      log(`  1. ${needsAnalysisNormal} repositories should be analyzed in normal mode`, 'yellow');
      log('  2. If tier counters still don\'t update, there may be a different issue', 'yellow');
      log('  3. Check browser console for actual HTTP calls being made', 'cyan');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();
