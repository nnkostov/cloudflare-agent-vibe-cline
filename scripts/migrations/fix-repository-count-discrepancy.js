/**
 * Repository Count Discrepancy Fix
 * 
 * This script addresses the discrepancy between repository counts shown on different pages:
 * - Overview/Controls pages: Show 621 repos for Tier 3 (raw count from repo_tiers)
 * - Leaderboard page: Shows 605 repos for Tier 3 (JOIN-based count)
 * 
 * The script will:
 * 1. Identify orphaned repo_tiers records (no matching repository)
 * 2. Identify repositories missing tier assignments
 * 3. Remove orphaned repo_tiers records
 * 4. Flag repositories without tiers for manual review
 * 5. Generate detailed before/after report
 */

import { Env } from './src/types/index.js';

// Mock environment for local testing
const env = {
  DB: null, // Will be set when running in Cloudflare Workers context
};

/**
 * Main diagnostic and cleanup function
 */
async function fixRepositoryCountDiscrepancy(env) {
  console.log('🔍 Starting Repository Count Discrepancy Analysis...\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    before: {},
    after: {},
    orphanedRecords: [],
    missingTierAssignments: [],
    actions: [],
    summary: {}
  };

  try {
    // Step 1: Get current state (BEFORE)
    console.log('📊 Analyzing current state...');
    report.before = await getCurrentState(env.DB);
    
    console.log('BEFORE STATE:');
    console.log(`- Tier 1: ${report.before.rawCounts.tier1} raw, ${report.before.joinCounts.tier1} with repos`);
    console.log(`- Tier 2: ${report.before.rawCounts.tier2} raw, ${report.before.joinCounts.tier2} with repos`);
    console.log(`- Tier 3: ${report.before.rawCounts.tier3} raw, ${report.before.joinCounts.tier3} with repos`);
    console.log(`- Total repositories: ${report.before.totalRepositories}`);
    console.log(`- Total tier assignments: ${report.before.totalTierAssignments}\n`);

    // Step 2: Identify orphaned repo_tiers records
    console.log('🔍 Identifying orphaned repo_tiers records...');
    report.orphanedRecords = await findOrphanedRepoTiers(env.DB);
    
    if (report.orphanedRecords.length > 0) {
      console.log(`❌ Found ${report.orphanedRecords.length} orphaned repo_tiers records:`);
      report.orphanedRecords.forEach(record => {
        console.log(`   - Tier ${record.tier}: repo_id ${record.repo_id}`);
      });
    } else {
      console.log('✅ No orphaned repo_tiers records found');
    }
    console.log('');

    // Step 3: Identify repositories missing tier assignments
    console.log('🔍 Identifying repositories missing tier assignments...');
    report.missingTierAssignments = await findRepositoriesWithoutTiers(env.DB);
    
    if (report.missingTierAssignments.length > 0) {
      console.log(`⚠️  Found ${report.missingTierAssignments.length} repositories missing tier assignments:`);
      report.missingTierAssignments.forEach(repo => {
        console.log(`   - ${repo.full_name} (${repo.stars} stars, created: ${repo.created_at})`);
      });
      console.log('\n📝 These repositories should be manually reviewed for tier assignment.');
    } else {
      console.log('✅ All repositories have tier assignments');
    }
    console.log('');

    // Step 4: Clean up orphaned records
    if (report.orphanedRecords.length > 0) {
      console.log('🧹 Cleaning up orphaned repo_tiers records...');
      const cleanupResult = await cleanupOrphanedRepoTiers(env.DB, report.orphanedRecords);
      report.actions.push({
        action: 'cleanup_orphaned_repo_tiers',
        recordsRemoved: cleanupResult.removed,
        details: cleanupResult.details
      });
      console.log(`✅ Removed ${cleanupResult.removed} orphaned repo_tiers records\n`);
    }

    // Step 5: Get final state (AFTER)
    console.log('📊 Analyzing final state...');
    report.after = await getCurrentState(env.DB);
    
    console.log('AFTER STATE:');
    console.log(`- Tier 1: ${report.after.rawCounts.tier1} raw, ${report.after.joinCounts.tier1} with repos`);
    console.log(`- Tier 2: ${report.after.rawCounts.tier2} raw, ${report.after.joinCounts.tier2} with repos`);
    console.log(`- Tier 3: ${report.after.rawCounts.tier3} raw, ${report.after.joinCounts.tier3} with repos`);
    console.log(`- Total repositories: ${report.after.totalRepositories}`);
    console.log(`- Total tier assignments: ${report.after.totalTierAssignments}\n`);

    // Step 6: Generate summary
    report.summary = generateSummary(report);
    
    console.log('📋 SUMMARY:');
    console.log(`- Orphaned records removed: ${report.summary.orphanedRecordsRemoved}`);
    console.log(`- Repositories flagged for manual review: ${report.summary.repositoriesNeedingReview}`);
    console.log(`- Data consistency achieved: ${report.summary.dataConsistencyAchieved ? '✅ YES' : '❌ NO'}`);
    console.log(`- Tier count discrepancies resolved: ${report.summary.discrepanciesResolved ? '✅ YES' : '❌ NO'}\n`);

    // Step 7: Validation
    const validation = await validateDataConsistency(env.DB);
    if (validation.isConsistent) {
      console.log('✅ Data consistency validation PASSED');
      console.log('🎉 Repository count discrepancy fix completed successfully!\n');
    } else {
      console.log('❌ Data consistency validation FAILED');
      console.log('⚠️  Manual intervention may be required\n');
      report.summary.validationErrors = validation.errors;
    }

    return report;

  } catch (error) {
    console.error('❌ Error during repository count discrepancy fix:', error);
    report.error = error.message;
    return report;
  }
}

/**
 * Get current state of repository and tier data
 */
async function getCurrentState(db) {
  // Raw counts from repo_tiers table
  const rawCounts = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM repo_tiers WHERE tier = 1').first(),
    db.prepare('SELECT COUNT(*) as count FROM repo_tiers WHERE tier = 2').first(),
    db.prepare('SELECT COUNT(*) as count FROM repo_tiers WHERE tier = 3').first(),
    db.prepare('SELECT COUNT(*) as count FROM repo_tiers').first(),
  ]);

  // JOIN-based counts (repositories with tiers)
  const joinCounts = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as count 
      FROM repositories r 
      JOIN repo_tiers rt ON r.id = rt.repo_id 
      WHERE rt.tier = 1
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as count 
      FROM repositories r 
      JOIN repo_tiers rt ON r.id = rt.repo_id 
      WHERE rt.tier = 2
    `).first(),
    db.prepare(`
      SELECT COUNT(*) as count 
      FROM repositories r 
      JOIN repo_tiers rt ON r.id = rt.repo_id 
      WHERE rt.tier = 3
    `).first(),
  ]);

  // Total repository count
  const totalRepos = await db.prepare('SELECT COUNT(*) as count FROM repositories').first();

  return {
    rawCounts: {
      tier1: rawCounts[0].count,
      tier2: rawCounts[1].count,
      tier3: rawCounts[2].count,
    },
    joinCounts: {
      tier1: joinCounts[0].count,
      tier2: joinCounts[1].count,
      tier3: joinCounts[2].count,
    },
    totalRepositories: totalRepos.count,
    totalTierAssignments: rawCounts[3].count,
  };
}

/**
 * Find orphaned repo_tiers records (tier assignments without corresponding repositories)
 */
async function findOrphanedRepoTiers(db) {
  const result = await db.prepare(`
    SELECT rt.repo_id, rt.tier, rt.created_at
    FROM repo_tiers rt
    LEFT JOIN repositories r ON rt.repo_id = r.id
    WHERE r.id IS NULL
    ORDER BY rt.tier, rt.created_at
  `).all();

  return result.results || [];
}

/**
 * Find repositories without tier assignments
 */
async function findRepositoriesWithoutTiers(db) {
  const result = await db.prepare(`
    SELECT r.id, r.full_name, r.stars, r.created_at
    FROM repositories r
    LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
    WHERE rt.repo_id IS NULL
    ORDER BY r.stars DESC, r.created_at DESC
  `).all();

  return result.results || [];
}

/**
 * Clean up orphaned repo_tiers records
 */
async function cleanupOrphanedRepoTiers(db, orphanedRecords) {
  if (orphanedRecords.length === 0) {
    return { removed: 0, details: [] };
  }

  const details = [];
  let totalRemoved = 0;

  // Group by tier for better reporting
  const byTier = orphanedRecords.reduce((acc, record) => {
    if (!acc[record.tier]) acc[record.tier] = [];
    acc[record.tier].push(record.repo_id);
    return acc;
  }, {});

  // Remove orphaned records tier by tier
  for (const [tier, repoIds] of Object.entries(byTier)) {
    const placeholders = repoIds.map(() => '?').join(',');
    const result = await db.prepare(`
      DELETE FROM repo_tiers 
      WHERE tier = ? AND repo_id IN (${placeholders})
    `).bind(tier, ...repoIds).run();

    const removed = result.changes || 0;
    totalRemoved += removed;
    
    details.push({
      tier: parseInt(tier),
      repoIds: repoIds,
      removed: removed
    });

    console.log(`   - Tier ${tier}: Removed ${removed} orphaned records`);
  }

  return { removed: totalRemoved, details };
}

/**
 * Generate summary of changes
 */
function generateSummary(report) {
  const orphanedRecordsRemoved = report.actions
    .filter(a => a.action === 'cleanup_orphaned_repo_tiers')
    .reduce((sum, a) => sum + a.recordsRemoved, 0);

  const repositoriesNeedingReview = report.missingTierAssignments.length;

  // Check if raw counts now match join counts
  const tier1Match = report.after.rawCounts.tier1 === report.after.joinCounts.tier1;
  const tier2Match = report.after.rawCounts.tier2 === report.after.joinCounts.tier2;
  const tier3Match = report.after.rawCounts.tier3 === report.after.joinCounts.tier3;
  
  const dataConsistencyAchieved = tier1Match && tier2Match && tier3Match;
  const discrepanciesResolved = dataConsistencyAchieved;

  return {
    orphanedRecordsRemoved,
    repositoriesNeedingReview,
    dataConsistencyAchieved,
    discrepanciesResolved,
    tierMatches: { tier1Match, tier2Match, tier3Match }
  };
}

/**
 * Validate data consistency after cleanup
 */
async function validateDataConsistency(db) {
  const errors = [];

  try {
    // Check for any remaining orphaned repo_tiers
    const orphanedCheck = await db.prepare(`
      SELECT COUNT(*) as count
      FROM repo_tiers rt
      LEFT JOIN repositories r ON rt.repo_id = r.id
      WHERE r.id IS NULL
    `).first();

    if (orphanedCheck.count > 0) {
      errors.push(`${orphanedCheck.count} orphaned repo_tiers records still exist`);
    }

    // Check for duplicate tier assignments
    const duplicateCheck = await db.prepare(`
      SELECT repo_id, COUNT(*) as count
      FROM repo_tiers
      GROUP BY repo_id
      HAVING COUNT(*) > 1
    `).all();

    if (duplicateCheck.results && duplicateCheck.results.length > 0) {
      errors.push(`${duplicateCheck.results.length} repositories have multiple tier assignments`);
    }

    // Verify raw counts match join counts
    const state = await getCurrentState(db);
    if (state.rawCounts.tier1 !== state.joinCounts.tier1) {
      errors.push(`Tier 1 count mismatch: ${state.rawCounts.tier1} raw vs ${state.joinCounts.tier1} join`);
    }
    if (state.rawCounts.tier2 !== state.joinCounts.tier2) {
      errors.push(`Tier 2 count mismatch: ${state.rawCounts.tier2} raw vs ${state.joinCounts.tier2} join`);
    }
    if (state.rawCounts.tier3 !== state.joinCounts.tier3) {
      errors.push(`Tier 3 count mismatch: ${state.rawCounts.tier3} raw vs ${state.joinCounts.tier3} join`);
    }

  } catch (error) {
    errors.push(`Validation query failed: ${error.message}`);
  }

  return {
    isConsistent: errors.length === 0,
    errors
  };
}

/**
 * Export for use in Cloudflare Workers or Node.js
 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fixRepositoryCountDiscrepancy };
}

// For direct execution in Node.js (testing)
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('fix-repository-count-discrepancy.js')) {
  console.log('⚠️  This script is designed to run in Cloudflare Workers context');
  console.log('📝 To run this script:');
  console.log('   1. Deploy to Cloudflare Workers');
  console.log('   2. Call the fixRepositoryCountDiscrepancy function with proper env.DB');
  console.log('   3. Or integrate into your existing worker for one-time execution\n');
}
